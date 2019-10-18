import axios from 'axios'
import fs from 'fs'
import path from 'path'
import MockAdapter from 'axios-mock-adapter'
import mockLogger from '../test-fixtures/mock-logger'
import QueryError from './query-error'

const httpMock = new MockAdapter(axios);


describe('Proxy Artifactory requests', () => {
  let proxy;

  afterEach(() => {
    httpMock.reset();
  });

  describe('Query for artifacts', () => {


    test('returns an empty result when no artifacts were found', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      mockEmptyQueryResponse();

      const foundArtifactsResults = await proxy.getArtifacts({
        "unit": "year",
        "duration": "4"
      }, false);
      expect(foundArtifactsResults).toMatchSnapshot([]);
    });

    test('returns the artifacts with normalized paths of found artifacts when queried with an object', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      mockFilteredQueryResponse();
      const foundArtifacts = await proxy.getArtifacts({
        "unit": "year",
        "duration": "1"
      }, true);
      expect(foundArtifacts).toMatchSnapshot();
    });

    test('returns the artifacts with normalized paths of found artifacts when queried with an string', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      mockFilteredQueryResponse();
      const foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
      expect(foundArtifacts).toMatchSnapshot();
    });


    test('returns the artifacts when queried with an a keep argument ', async () => {
      mockKeepLast3ThresholdArgs();
      proxy = require('./proxy');
      mockFilteredQueryResponse();
      const foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
      expect(foundArtifacts).toMatchSnapshot();
    });


    test('returns the artifacts when queried with prefix', async () => {
      const args = mockKeepLast3ThresholdArgs();
      const prefix = 'libs-release-local/com/dundermifflin';
      args.getPrefixFilter = () => prefix;

      proxy = require('./proxy');
      mockFilteredQueryResponse();
      const foundArtifacts = await proxy.getArtifacts('2018-09-25T19:45:10+00:00');
      expect(foundArtifacts).toMatchSnapshot();
    });


    test('throws an exception if query returned 404', async (done) => {
      mockSimpleArgs();
      const args = require('../args');
      proxy = require('./proxy');
      httpMock.onPost().reply(404);
      const expectedException = new QueryError('/Problem reading response from Artifactory');
      expectedException.url = args.getConnectionDefaults().baseURL;
      await expect(proxy.getArtifacts({
        "unit": "year",
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
        "unit": "year is a long time",
        "duration": "1"
      })).rejects.toThrow('Problem reading response from Artifactory');
    });

    function mockEmptyQueryResponse() {
      httpMock.onPost().reply(200, {results: []});
    }


    function mockMalformedQueryResponse() {
      httpMock.onPost().reply(200, {});
    }

    function mockFilteredQueryResponse() {
      const expectedResponse = require('./fixtures/test-response');
      httpMock.onPost().reply(200, {"results": expectedResponse});
    }
  });

  describe('Delete artifacts', () => {
    test('artifacts specified are deleted', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      mockDeleteSuccesfulResponse();
      const mockedArtifacts = getMockedFoundArtifacts();
      const deletedArtifacts = await proxy.deleteArtifacts(mockedArtifacts, false);
      expect(deletedArtifacts).toMatchSnapshot()
    });

    test('only filtered prefix artifacts are deleted', async () => {
      const args = mockSimpleArgs();
      const prefix = 'libs-release-local/com/dundermifflin';
      args.getPrefixFilter = () => prefix;
      proxy = require('./proxy');
      mockDeleteSuccesfulResponse();
      const mockedArtifacts = getMockedFoundArtifacts();
      const deletedArtifacts = await proxy.deleteArtifacts(mockedArtifacts, false);
      expect(deletedArtifacts).toMatchSnapshot()
    });

    function mockDeleteSuccesfulResponse() {
      httpMock.onDelete().reply(200, {results: []});
    }

    test('artifacts specified are not deleted when dryRun is on', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      const deleteSpy = proxy.spytRestMethodReferece(jest.spyOn, 'delete');
      mockDeleteSuccesfulResponse();
      const mockedArtifacts = getMockedFoundArtifacts();
      const deletedArtifacts = await proxy.deleteArtifacts(mockedArtifacts, true);
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(deletedArtifacts).toMatchSnapshot()
    });

    test('artifacts specified are not deleted when dryRun is on implicitly', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      const deleteSpy = proxy.spytRestMethodReferece(jest.spyOn, 'delete');
      mockDeleteSuccesfulResponse();
      const mockedArtifacts = getMockedFoundArtifacts();
      const deletedArtifacts = await proxy.deleteArtifacts(mockedArtifacts);
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(deletedArtifacts).toMatchSnapshot()
    });


    test('artifacts specified are not deleted when there is a network error', async () => {
      mockSimpleArgs();
      proxy = require('./proxy');
      const deleteSpy = proxy.spytRestMethodReferece(jest.spyOn, 'delete');
      mockDeleteNetworkErrorResponse();
      const mockedArtifacts = getMockedFoundArtifacts();
      const deletedArtifacts = await proxy.deleteArtifacts(mockedArtifacts, false);
      expect(deleteSpy).toHaveBeenCalled();
      expect(deletedArtifacts).toMatchSnapshot();

    });

    function mockDeleteNetworkErrorResponse() {
      httpMock.onDelete().networkError();
    }

    function getMockedFoundArtifacts() {
      const mocked = JSON.parse(fs.readFileSync(path.resolve(__dirname, './fixtures/mocked-to-be-deleted-artifacts.json')), mapReviver);
 //     const newStruct = [...mocked.values()];
 //     const unmocked = JSON.stringify(newStruct, jsonCollectionMapper);
      return mocked;
    }

  });

  function mapReviver(key, value) {
    if (typeof value !== "object") return value;
    switch (value["<kind>"]) {
      case undefined:
        return value;
      case "Map": {
        const newValue = new Map;
        const mapData = value["<mapData>"];
        if (!mapData) return value;
        mapData.forEach(e => newValue.set(e[0], e[1]));
        return newValue;
      }
      default:
        return value;
    }
  }

  function jsonCollectionMapper(key, value) {
    return value instanceof Set || value instanceof Map ? {
      "<kind>": value[Symbol.toStringTag],
      "<mapData>": Array.from(value)
    } : value;
  }

  function mockKeepLast3ThresholdArgs() {
    const args = mockSimpleArgs();
    args.getThresholdKeep = () => 3;
    return args;
  }

  function mockSimpleArgs() {
    jest.mock('../args');
    const args = require('../args');
    args.getConnectionDefaults.mockReturnValue({
      baseURL: "http://acme.org",
      auth: {
        username: 'jane.doe@acme.org',
        password: 'gift-token'
      },
      headers: {'content-type': 'text/plain'}
    });
    args.getLoggingLevel.mockReturnValue('info');
    args.getPrefixFilter = () => undefined;
    mockLogger();
    return args;
  }
});
