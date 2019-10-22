import axiosFactory from 'axios'
import chalk from 'chalk'
import moment from 'moment'
import _ from 'lodash'
import filesize from "filesize";
import logger from '../logging'
import args from '../args'
import QueryError from './query-error'
import MalformedQueryError from './malformed-query-error'
import queryText from './fixtures/query.json'

const axios = axiosFactory.create(args.getConnectionDefaults());
const queryEndpoint = 'search/aql';
const itemPropertiesQueryEndpoint = 'storage/';
const api = 'api/';
const excludedArtifacts = ['maven-metadata.xml'];

async function getAqlQueryResult(query) {
  let results = [];
  try {
    const response = await axios.post(api + queryEndpoint, query);
    results = response.data.results;
    if (results === undefined) {
      throw MalformedQueryError('Received malformed response error when querying Artifactory server: %s');
    }
  } catch (error) {
    logger.debug(error);
    throw error;
  }
  return results;
}


function getFilteredToBeDeleted(results, isDryRun) {
  const dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';

  let thresholdKeep = args.getThresholdKeep() || 0;
  const prefixFilter = args.getPrefixFilter();
  if (prefixFilter) {
    logger.debug('Prefix filter is:' + prefixFilter);
  } else {
    logger.debug('No prefix filter');
  }
  let totalSize = 0;
  const semVerRe = /^(?<artifactName>[^\.]+)-(?<artifactVersion>.*?)(?<isSource>-sources)?\.(?<artifactExtension>[a-z\.-]+)?\b$/;
  const semVerNuget = /^(?<artifactName>.*?)\.(?<artifactVersion>(\d+\.)+?([\d\w-]+))\.(?<artifactExtension>nupkg)$/;
  const resultMap = results.map(item => {
    let normalizedPathItem = getNormalizedPathItem(item);
    const res = semVerRe.exec(normalizedPathItem.name) || semVerNuget.exec(normalizedPathItem.name);
    normalizedPathItem = {...normalizedPathItem, ...res.groups, isSource: !!res.isSource};
    normalizedPathItem.artifactNamespace = normalizedPathItem.repo + ":" + normalizedPathItem.artifactName;
    return normalizedPathItem;
  })
    .filter(item => (!prefixFilter || item.normalizedPath.startsWith(prefixFilter)))
    .filter(item => excludedArtifacts.every(
      excludedFile => !item.normalizedPath.endsWith(excludedFile)))
    .reduce((map, item) => {
      const {artifactNamespace, normalizedPath} = item;
      map.indexedByPath[normalizedPath] = item;
      totalSize += item.size;
      const namespaceVersions = map.indexedByNamespace[artifactNamespace] || new Map();
      map.indexedByNamespace[artifactNamespace] = namespaceVersions;

      let namespaceVersion = namespaceVersions.get(item.artifactVersion);
      if (!namespaceVersion) {
        namespaceVersion = {items: [item], createdDate: new Date(item.created)};
      } else {
        namespaceVersion.items.push(item);
      }
      namespaceVersions.set(item.artifactVersion, namespaceVersion);
      return map;
    }, {indexedByPath: {}, indexedByNamespace: {}});
  const filteredArtifactsFound = [];
  logger.debug("%s Before keeping the newest found %d artifacts with size of:%s %s", dryrunPrefix, Object.keys(resultMap.indexedByPath).length, filesize(totalSize), dryrunPrefix);
  totalSize = 0;
  Object.values(resultMap.indexedByNamespace).forEach((namespaceVersions) => {
    const tempNamespaceVersions = new Map([...namespaceVersions.entries()]
      .sort((firstArtifactEntry, secondArtifactEntry) =>
        firstArtifactEntry[1].createdDate < secondArtifactEntry[1].createdDate ? 1 : -1));
    namespaceVersions.clear();
    let addedItems = thresholdKeep;
    tempNamespaceVersions.forEach((tempNamespaceVersionsEntry, tempNamespaceVersionsKey) => {
      if (addedItems > 0) {
        addedItems--;
      } else {
        tempNamespaceVersionsEntry.items.forEach(artifact => {
          logger.silly("%s About to delete %s: size:%s %s", dryrunPrefix, artifact.normalizedPath, filesize(artifact.size), dryrunPrefix)
          totalSize += artifact.size;
        });

        namespaceVersions.set(tempNamespaceVersionsKey, tempNamespaceVersionsEntry);
        filteredArtifactsFound.push(...tempNamespaceVersionsEntry.items);
      }
    })
  });
  logger.debug("%s About to a delete total of %d artifacts with size of:%s %s", dryrunPrefix, filteredArtifactsFound.length, filesize(totalSize), dryrunPrefix)

  return filteredArtifactsFound;
}

function getNormalizedPathItem(artifactItem) {
  let normalizedPath = '';

  if (artifactItem.path === '.') {
    normalizedPath = `${artifactItem.repo}/${artifactItem.name}`;
  } else {
    normalizedPath = `${artifactItem.repo}/${artifactItem.path}/${artifactItem.name}`;
  }
  artifactItem.normalizedPath = normalizedPath;
  return artifactItem;
}

async function getArtifacts(olderThan, isDryRun) {

  logger.debug('Threshold= %o', olderThan);

  logger.debug('Connection defaults= %o', args.getConnectionDefaults());
  const isOlderThan = _.isObject(olderThan) ? moment().subtract(olderThan.duration, olderThan.unit) :
    moment(olderThan);
  const thresholdTime = _.isUndefined(olderThan) ? undefined :
    isOlderThan;

  if (thresholdTime === undefined) {
    throw new Error("You have to specify a time threshold")
  }
  logger.debug('threshold=%s', thresholdTime.format());
  const compiledQuery = _.template(JSON.stringify(queryText))({
    filter: args.getRepositoryFilter(),
    thresholdTime: thresholdTime.format()
  });
  logger.debug('compiled query\n%s', compiledQuery);
  const query = `items.find(${compiledQuery}).include("*")`;
  let foundItemsResult = {};
  try {
    const queryResults = await getAqlQueryResult(query);
    foundItemsResult.items = queryResults;
  } catch (error) {
    logger.error(error);
    const queryException = new QueryError('Problem reading response from Artifactory');
    queryException.url = args.getConnectionDefaults().baseURL;

    throw queryException;
  }

  if (foundItemsResult.items.length === 0) {
    logger.warn('Found no items');
  }
  return getFilteredToBeDeleted(foundItemsResult.items, isDryRun);
}

async function deleteArtifacts(toBeDeletedFilteredArtifacts, isDryRun = true) {
  logger.info('Artifacts are about to be deleted %s', isDryRun ? chalk.yellowBright.bgBlue('***Dry Run***') : '');
  let deletedArtifactsResponse = {totalSize: 0};
  try {
    deletedArtifactsResponse = await deleteItemAqlQuery(toBeDeletedFilteredArtifacts, isDryRun);
  } catch (error) {
    logger.error(error);
  }

  return {...deletedArtifactsResponse};
}

async function deleteItemAqlQuery(itemToDeleteResponse, isDryRun) {
  let response;
  const deletedArtifactsResponse = {deletedArtifacts: [], totalSize: 0};
  const dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';
  const {deletedArtifacts} = deletedArtifactsResponse;
  try {
    for (const itemToDelete of itemToDeleteResponse) {
      logger.silly('%s About to delete %o %s', dryrunPrefix, itemToDelete, dryrunPrefix);
      if (!isDryRun) {
        response = await axios.delete(itemToDelete.normalizedPath);
        deletedArtifactsResponse.totalSize += itemToDelete.size;
        deletedArtifacts.push(itemToDelete);
      } else {
        response = await {status: 200};
      }
      logger.verbose(('%s Deleted %s(%s) %s'), dryrunPrefix, itemToDelete.normalizedPath,
        filesize(itemToDelete.size),
        dryrunPrefix);
    }
    return deletedArtifactsResponse;
  } catch (error) {
    logger.error('Received error %s when deleting %o in Artifactory server:\\n %s', error, itemToDeleteResponse);
    throw new Error("Error deleting from the server.")
  }
}


function spytRestMethodReferece(spyActor, method) {
  return spyActor(axios, method);
}

module.exports = {
  getArtifacts,
  deleteArtifacts,
  spytRestMethodReferece
};
