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
  }
  catch (error) {
    logger.debug(error);
    throw error;
  }
  return results;
}


function getResultMap(results) {
  const thresholdKeep = args.getThresholdKeep();
  const prefixFilter = args.getPrefixFilter();
  let totalSize = 0;
  const resultMap = results.map(item => getNormalizedPathItem(item))
                           .filter(item => (!prefixFilter || item.normalizedPath.startsWith(prefixFilter)))
                           .filter(item => excludedArtifacts.every(
                             excludedFile => !item.normalizedPath.endsWith(excludedFile)))
                           .reduce((accumulatedResult, item) => {
                             const artifactParent = item.normalizedPath.split('/');
                             artifactParent.pop();
                             const artifactParentPath = artifactParent.join('/');
                             artifactParent.pop();
                             const artifactGrandparentPath = artifactParent.join('/');
                             const foundArtifactGrandparent = getChildItem(accumulatedResult, artifactGrandparentPath);
                             const foundArtifactParent = getChildItem(foundArtifactGrandparent.items, artifactParentPath);
                             foundArtifactParent.items.set(item.normalizedPath, item);
                             foundArtifactParent.size += item.size;
                             const itemDate = new Date(item.created);
                             foundArtifactParent.createdDate =
                               foundArtifactParent.createdDate < itemDate ? foundArtifactParent.createdDate :
                               itemDate;
                             foundArtifactGrandparent.createdDate =
                               foundArtifactGrandparent.createdDate < foundArtifactParent.createdDate ?
                               foundArtifactGrandparent.createdDate : foundArtifactParent.createdDate;
                             foundArtifactGrandparent.size += item.size;
                             return accumulatedResult;
                           }, new Map());
  resultMap.forEach(grandparentArtifact => {
    const parentArtifacts = grandparentArtifact.items;
    let sortedArtifacts = new Map([...parentArtifacts.entries()].sort(([firstArtifactPath, firstArtifact],
                                                                       [secondArtifactPath, secondArtifact]) => firstArtifact.createdDate <
                                                                                                                secondArtifact.createdDate ?
                                                                                                                1 :
                                                                                                                -1));
    if (thresholdKeep) {
      const truncatedArtifacts = [...sortedArtifacts.entries()];
      truncatedArtifacts.splice(0, Math.min(thresholdKeep, truncatedArtifacts.length));
      sortedArtifacts = new Map(truncatedArtifacts);
    }
    const adjustedSize = [...sortedArtifacts.values()].reduce((sum, currentArtifact) => sum + currentArtifact.size,
                                                              0);
    grandparentArtifact.size = adjustedSize;
    totalSize += grandparentArtifact.size;

    grandparentArtifact.items = sortedArtifacts;
  });

  return {
    items: resultMap,
    totalSize
  };
}

function getChildItem(childItems, childPath) {
  let foundChild = childItems.get(childPath);
  if (foundChild === undefined) {
    foundChild = {
      size:        0,
      items:       new Map(),
      createdDate: new Date()
    };
    childItems.set(childPath, foundChild);
  }
  return foundChild;
}

function getNormalizedPathItem(artifactItem) {
  let normalizedPath = '';

  if (artifactItem.path === '.') {
    normalizedPath = artifactItem.repo;
  } else {
    normalizedPath = `${artifactItem.repo}/${artifactItem.path}/${artifactItem.name}`;
  }
  artifactItem.normalizedPath = normalizedPath;
  return artifactItem;
}

async function getArtifacts(olderThan) {

  logger.verbose('Threshold= %o', olderThan);

  logger.verbose('Connection defaults= %o', args.getConnectionDefaults());
  const isOlderThan = _.isObject(olderThan) ? moment().subtract(olderThan.duration, olderThan.unit) :
                      moment(olderThan);
  const thresholdTime = _.isUndefined(olderThan) ? undefined :
                        isOlderThan;

  if (thresholdTime === undefined) {
    throw new Error("You have to specify a time threshold")
  }
  logger.verbose('threshold=%s', thresholdTime.format());
  const compiledQuery = _.template(JSON.stringify(queryText))({
                                                                filter:        args.getRepositoryFilter(),
                                                                thresholdTime: thresholdTime.format()
                                                              });
  logger.info('compiled query\n%s', compiledQuery);
  const query = `items.find(${compiledQuery})`;
  let foundItemsResult;
  try {
    const queryResults = await getAqlQueryResult(query);
    foundItemsResult = getResultMap(queryResults);
  }
  catch (error) {
    logger.debug(error);
    const queryException = new QueryError('Problem reading response from Artifactory');
    queryException.url = args.getConnectionDefaults().baseURL;

    throw queryException;
  }

  if (!foundItemsResult.items.size) {
    logger.warn('Found no items');
  }
  foundItemsResult.thresholdTime = thresholdTime.format();

  return foundItemsResult;
}

async function deleteArtifacts(itemsToDelete, isDryRun = true) {
  const succesfulOperations = [];

  logger.info('Artifacts are about to be deleted %s', isDryRun ? chalk.yellowBright.bgBlue('***Dry Run***') : '');

  for (const artifactGrandparentEntry of itemsToDelete) {
    try {
      const deletedPaths = await deleteItemAqlQuery(artifactGrandparentEntry, isDryRun);
      succesfulOperations.push(...deletedPaths);

    }
    catch (error) {
        logger.debug(error);
    }
  }
  return succesfulOperations;
}


async function deleteItemAqlQuery([artifactGrandparentPath, artifactGrandparent], isDryRun) {
  let response;
  const deletedPaths = [];
  const dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';
  logger.info('%sAbout to delete %s(%s)%s', dryrunPrefix, artifactGrandparentPath,
              filesize(artifactGrandparent.size), dryrunPrefix);
  try {
    for (const [artifactParentPath, artifactParent] of artifactGrandparent.items) {
      if (!isDryRun) {
        response = await axios.delete(artifactParentPath);
      } else {
        response = await { status: 200 };
      }
      logger.debug(('%sDeleted %s(%s) created date(%s)%s'), dryrunPrefix, filesize(artifactParent.size),
                   artifactParentPath,moment(artifactParent.createdDate).format('LLL'), dryrunPrefix);
      deletedPaths.push(artifactParentPath);
    }

    return deletedPaths;
  }
  catch (error) {
    logger.error('Received error %s when deleting %s in Artifactory server:\\n %s', error, artifactGrandparentPath);
    throw new Error("Error deleting from the server.")
  }
}


function spytMethodReferece(spyActor, method) {
  return spyActor(axios, method);
}


module.exports = {
  getArtifacts,
  deleteArtifacts,
  spytMethodReferece
};
