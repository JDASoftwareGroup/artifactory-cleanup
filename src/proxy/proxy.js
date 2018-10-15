'use strict';

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
    let thresholdKeep = args.getThresholdKeep();
    let prefixFilter = args.getPrefixFilter(), totalSize = 0;
    let resultMap = results.map(item => getNormalizedPathItem(item))
                           .filter(item => (!prefixFilter || item.normalizedPath.startsWith(prefixFilter)))
                           .filter(item => excludedArtifacts.every(
                               excludedFile => !item.normalizedPath.endsWith(excludedFile)))
                           .reduce((accumulatedResult, item) => {
                               let artifactParent = item.normalizedPath.split('/'), artifactParentPath,
                                   artifactGrandparentPath;
                               let foundArtifactParent, foundArtifactGrandparent;
                               artifactParent.pop();
                               artifactParentPath = artifactParent.join('/');
                               artifactParent.pop();
                               artifactGrandparentPath = artifactParent.join('/');
                               foundArtifactGrandparent = getChildItem(accumulatedResult, artifactGrandparentPath);
                               foundArtifactParent = getChildItem(foundArtifactGrandparent.items, artifactParentPath);
                               foundArtifactParent.items.set(item.normalizedPath, item);
                               foundArtifactParent.size += item.size;
                               let itemDate = new Date(item.created);
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
        let parentArtifacts = grandparentArtifact.items;
        let sortedArtifacts = new Map([...parentArtifacts.entries()].sort(([firstArtifactPath, firstArtifact],
                                                                           [secondArtifactPath, secondArtifact]) => {
            return firstArtifact.createdDate <
                   secondArtifact.createdDate ? 1 : -1;
        }));
        let currentSize = grandparentArtifact.size;
        if (thresholdKeep) {
            let truncatedArtifacts = [...sortedArtifacts.entries()];
            truncatedArtifacts.length = Math.min(thresholdKeep, truncatedArtifacts.length);
            sortedArtifacts = new Map(truncatedArtifacts);
        }
        let adjustedSize = [...sortedArtifacts.values()].reduce((sum, currentArtifact) => sum + currentArtifact.size,
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
        normalizedPath = artifactItem.repo + '/' + artifactItem.path + '/' + artifactItem.name;
    }
    artifactItem.normalizedPath = normalizedPath;
    return artifactItem;
}

async function getArtifacts(olderThan) {

    logger.verbose('Threshold= %o', olderThan);

    logger.verbose('Connection defaults= %o', args.getConnectionDefaults());
    let thresholdTime = _.isUndefined(olderThan) ? undefined :
                        _.isObject(olderThan) ? moment().subtract(olderThan.duration, olderThan.unit) :
                        moment(olderThan);

    if (thresholdTime === undefined) {
        throw new Error("You have to specify a time threshold")
    }
    logger.verbose('threshold=%s', thresholdTime.format());
    const compiledQuery = _.template(JSON.stringify(queryText))({
                                                                    filter:        args.getRepositoryFilter(),
                                                                    thresholdTime: thresholdTime.format()
                                                                });
    logger.info('compiled query\n%s',compiledQuery);
    const query = `items.find(${compiledQuery})`;
    let foundItemsResult;
    try {
        let queryResults = await getAqlQueryResult(query);
        foundItemsResult = getResultMap(queryResults);
    }
    catch (error) {
        logger.debug(error);
        let queryException = new QueryError('Problem reading response from Artifactory');
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
    let succesfulOperations = [];

    logger.info('Artifacts are about to be deleted %s', isDryRun ? chalk.yellowBright.bgBlue('***Dry Run***') : '');

    for (const artifactGrandparentEntry of itemsToDelete) {
        try {
            let deletedPaths = await deleteItemAqlQuery(artifactGrandparentEntry, isDryRun);
            succesfulOperations.push(...deletedPaths);

        }
        catch (error) {
            //  logger.debug('Delete operation failed for %s. Error: ', artifactItemParentPathEntry[0], error);
        }
    }
    return succesfulOperations;
}


async function deleteItemAqlQuery([artifactGrandparentPath, artifactGrandparent], isDryRun) {
    let response, deletedPaths = [];
    let dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';
    logger.info('%sAbout to delete %s(%s)%s', dryrunPrefix, artifactGrandparentPath,
                filesize(artifactGrandparent.size), dryrunPrefix);
    try {
        for (let [artifactParentPath, artifactParent] of artifactGrandparent.items) {
            if (!isDryRun) {
                response = await axios.delete(artifactParentPath);
            } else {
                response = await { status: 200 };
            }
            logger.debug(('%sDeleted %s(%s)%s'), dryrunPrefix, artifactParent.size,
                         artifactParentPath, dryrunPrefix);
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
    getArtifacts:       getArtifacts,
    deleteArtifacts:    deleteArtifacts,
    spytMethodReferece: spytMethodReferece
};