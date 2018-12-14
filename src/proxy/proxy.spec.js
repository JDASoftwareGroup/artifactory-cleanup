'use strict';

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import MockAdapter from 'axios-mock-adapter'
import {equal} from 'assert'
import mockLogger from '../test-fixtures/mock-logger'
import QueryError from './query-error'

let httpMock = new MockAdapter(axios);


describe('Proxy Artifactory requests', () => {
    let proxy;

    afterEach(function () {
        httpMock.reset();
    });

    describe('Query for artifacts', () => {


        test('returns an empty result when no artifacts were found', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            mockEmptyQueryResponse();

            let foundArtifactsResults = await proxy.getArtifacts({
                "unit":     "year",
                "duration": "4"
            });
            expect(foundArtifactsResults).toMatchSnapshot({
                thresholdTime: expect.any(String)
            });
        });

        test('returns the artifacts with normalized paths of found artifacts when queried with an object', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            mockFilteredQueryResponse();
            let foundArtifacts = await proxy.getArtifacts({
                "unit":     "year",
                "duration": "1"
            });
            expect(foundArtifacts).toMatchSnapshot({
                thresholdTime: expect.any(String)
            });
        });

        test('returns the artifacts with normalized paths of found artifacts when queried with an string', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            mockFilteredQueryResponse();
            let foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
            let json= JSON.stringify(foundArtifacts, jsonCollectionMapper);
            expect(foundArtifacts).toMatchSnapshot({
                thresholdTime: expect.any(String)
            });
        });


        test('returns the artifacts when queried with an a keep argument ', async () => {
            mockKeepLast3ThresholdArgs();
            proxy = require('./proxy');
            mockFilteredQueryResponse();
            let foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
            let json= JSON.stringify(foundArtifacts, jsonCollectionMapper);
            expect(foundArtifacts).toMatchSnapshot({
                                                       thresholdTime: expect.any(String)
                                                   });
        });


        test('returns the artifacts when queried with prefix', async () => {
            let args = mockKeepLast3ThresholdArgs();
            let prefix = 'libs-release-local/com/dundermifflin';
            args.getPrefixFilter = () => prefix;

            proxy = require('./proxy');
            mockFilteredQueryResponse();
            let foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
            let json= JSON.stringify(foundArtifacts, jsonCollectionMapper);
            expect(foundArtifacts).toMatchSnapshot({
                                                       thresholdTime: expect.any(String)
                                                   });
        });


        test('throws an exception if query returned 404', async (done) => {
            mockSimpleArgs();
            const args = require('../args');
            proxy = require('./proxy');
            httpMock.onPost().reply(404);
            let expectedException = new QueryError('/Problem reading response from Artifactory');
            expectedException.url = args.getConnectionDefaults().baseURL;
            await expect(proxy.getArtifacts({
                "unit":     "year",
                "duration": "1"
            })).rejects.toThrow();

            done();
        });


        test('throws an error message if a threshold is not provided', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            await expect(proxy.getArtifacts()).rejects.toThrow('You have to specify a time threshold');
        });


        test('throws an malformed response error message if a bad response received', async () => {
            mockMalformedQueryResponse();
            proxy = require('./proxy');
            await expect(proxy.getArtifacts({
                "unit":     "year is a long time",
                "duration": "1"
            })).rejects.toThrow('Problem reading response from Artifactory');
        });

        function mockEmptyQueryResponse() {
            httpMock.onPost().reply(200, { results: [] });
        }


        function mockMalformedQueryResponse() {
            httpMock.onPost().reply(200, {});
        }

        function mockFilteredQueryResponse() {
            const expectedResponse = require('./fixtures/test-response');
            httpMock.onPost().reply(200, { "results": expectedResponse });
        }
    });

    describe('Delete artifacts', () => {
        test('artifacts specified are deleted', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            mockDeleteSuccesfulResponse();
            let mockedArtifacts = getMockedFoundArtifacts();
            let deletedPaths = await proxy.deleteArtifacts(mockedArtifacts, true);
            expect(deletedPaths).toMatchSnapshot()
        });

        test('only filtered prefix artifacts are deleted', async () => {
            let args = mockSimpleArgs();
            let prefix = 'libs-release-local/com/dundermifflin';
            args.getPrefixFilter = () => prefix;
            proxy = require('./proxy');
            mockDeleteSuccesfulResponse();
            let mockedArtifacts = getMockedFoundArtifacts();
            let deletedPaths = await proxy.deleteArtifacts(mockedArtifacts, true);
            expect(deletedPaths).toMatchSnapshot()
        });

        function mockDeleteSuccesfulResponse() {
            httpMock.onDelete().reply(200, { results: [] });
        }

        test('artifacts specified are not deleted when dryRun is on', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            let deleteSpy = proxy.spytMethodReferece(jest.spyOn, 'delete');
            mockDeleteSuccesfulResponse();
            let mockedArtifacts = getMockedFoundArtifacts();
            let deletedPaths = await proxy.deleteArtifacts(mockedArtifacts, false);
            expect(deleteSpy).toHaveBeenCalled();
            expect(deletedPaths).toMatchSnapshot()
        });

        test('artifacts specified are not deleted when dryRun is on implicitly', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            let deleteSpy = proxy.spytMethodReferece(jest.spyOn, 'delete');
            mockDeleteSuccesfulResponse();
            let mockedArtifacts = getMockedFoundArtifacts();
            let deletedPaths = await proxy.deleteArtifacts(mockedArtifacts);
            expect(deleteSpy).toHaveBeenCalled();
            expect(new Set(deletedPaths)).toMatchSnapshot()
        });


        test('artifacts specified are not deleted when there is a network error', async () => {
            mockSimpleArgs();
            proxy = require('./proxy');
            let deleteSpy = proxy.spytMethodReferece(jest.spyOn, 'delete');
            mockDeleteNetworkErrorResponse();
            let mockedArtifacts = getMockedFoundArtifacts();
            let deletedPaths = await proxy.deleteArtifacts(mockedArtifacts, false);
            expect(deleteSpy).toHaveBeenCalled();
            expect(deletedPaths).toMatchSnapshot()

        });

        function mockDeleteSuccesfulResponse() {
            httpMock.onDelete().reply(200, { results: [] });
        }

        function mockDeleteNetworkErrorResponse() {
            httpMock.onDelete().networkError();
        }

        function getMockedFoundArtifacts() {
           return JSON.parse(fs.readFileSync(path.resolve(__dirname,'./fixtures/mocked-to-be-deleted-artifacts.json')), mapReviver).items;
        }

    });

    function mapReviver(key, value) {
        if (typeof value != "object") return value;
        switch (value["<kind>"]){
            case undefined: return value;
            case "Map": {
                let newValue = new Map;
                let mapData = value["<mapData>"];
                if (!mapData) return value;
                mapData.forEach(e=>newValue.set(e[0], e[1]));
                return newValue;
            }
            default: return value;
        }
    }

    function jsonCollectionMapper(key, value){
        return value instanceof Set || value instanceof Map ? {"<kind>":value[Symbol.toStringTag],"<mapData>": Array.from(value)} : value;
    }

    function mockKeepLast3ThresholdArgs() {
        let args = mockSimpleArgs();
        args.getThresholdKeep = () => 3;
        return args;
    }

    function mockSimpleArgs() {
        jest.mock('../args');
        const args = require('../args');
        args.getConnectionDefaults.mockReturnValue({
            baseURL: "http://acme.org",
            auth:    {
                username: 'jane.doe@acme.org',
                password: 'gift-token'
            },
            headers: { 'content-type': 'text/plain' }
        });
        args.getLoggingLevel.mockReturnValue('info');
        args.getPrefixFilter = () => undefined;
        mockLogger();
        return args;
    }
});
