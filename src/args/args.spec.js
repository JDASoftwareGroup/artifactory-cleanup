'use strict';

const MOCK_URL = 'http://acme.org';
const MOCK_USER = 'jane.doe@acme.org';
const MOCK_TOKEN = 'gift-token';
const MOCK_LOGGING_LEVEL = 'info';
const MOCK_SILENT_SETTING = true;
const MOCK_DRY_RUN_SETTING = true;
const MOCK_DATE_THESHOLD_SETTING = '2008-09-15T15:53:00+05:00';
const MOCK_UNIT_THESHOLD_SETTING = 'years';
const MOCK_KEEP_THESHOLD_SETTING = 4;
const MOCK_DURATION_THESHOLD_SETTING = 5;
const MOCK_PREFIX_FILTER_SETTING = '/my/repostiory';


describe('Test argv setting', () => {
    jest.mock('yargs');

    const yargs = require('yargs');
    const args = require('./args');

    beforeEach(() => {
        mockYargs();
    });

    describe('Test individual options', () => {


        test('setting of connection defaults', () => {
            expect(args.getConnectionDefaults()).toEqual({
                "auth": {
                    "password": MOCK_TOKEN,
                    "username": MOCK_USER
                },
                "baseURL": MOCK_URL,
                "headers": { "content-type": "text/plain" }
            });
        });

        test('setting of quiet output', () => {
            expect(args.isQuiet()).toBe(true);
        });

        test('setting of logging level', () => {
            expect(args.getLoggingLevel()).toBe(MOCK_LOGGING_LEVEL);
        });

        test('setting of dry run', () => {
            expect(args.isDryRun()).toBe(MOCK_DRY_RUN_SETTING);
        });

        test('setting of date threshold', () => {
            expect(args.getThresholdDate()).toBe(MOCK_DATE_THESHOLD_SETTING);
        });

        test('setting of duration threshold', () => {
            expect(args.getThresholdDuration()).toBe(MOCK_DURATION_THESHOLD_SETTING);
        });

        test('setting of unit threshold', () => {
            expect(args.getThresholdUnit()).toBe(MOCK_UNIT_THESHOLD_SETTING);
        });

        test('setting of date threshold', () => {
            expect(args.checkDependencies({ d: MOCK_DATE_THESHOLD_SETTING })).toBe(true);
        });

        test('setting of path filter', () => {
            expect(args.getPrefixFilter()).toBe(MOCK_PREFIX_FILTER_SETTING);
        });

        test('setting of keep threshold', () => {
            expect(args.getThresholdKeep()).toBe(MOCK_KEEP_THESHOLD_SETTING);
        });

        test('setting of duration threshold', () => {
            expect(args.checkDependencies({
                n: MOCK_UNIT_THESHOLD_SETTING,
                o: MOCK_DURATION_THESHOLD_SETTING
            })).toBe(true);
        });

        test('reject setting of no threshold', () => {
            expect(() => {
                args.checkDependencies();
            }).toThrowErrorMatchingSnapshot();

        })
    });
    describe('Test command line calls', () => {

        describe('Test basic command line', () => {
            test('getting the help error if no arguments are set', () => {
                jest.unmock('yargs');
                mockYargs(false);
                let exitSpy = jest.spyOn(process, "exit").mockImplementation(number => number);
                args.isDryRun();
                expect(exitSpy).toHaveBeenCalledWith(1);
            })
        });
    });

    function mockYargs(mockExit = true) {
        let yargsMockValues = generateYargsMockValues();
        jest.spyOn(yargs, 'usage').mockImplementation(() => yargsMockValues);
        jest.spyOn(yargs, 'option').mockImplementation(() => yargsMockValues);
        jest.spyOn(yargs, 'help').mockImplementation(() => yargsMockValues);
        jest.spyOn(yargs, 'check').mockImplementation(() => yargsMockValues);
        if (mockExit) {
            jest.spyOn(yargs, 'exitProcess').mockImplementation(() => yargsMockValues);
        }
    }

    function generateYargsMockValues() {
        return Object.assign({
            argv: {
                'a': MOCK_URL,
                'u': MOCK_USER,
                't': MOCK_TOKEN,
                'l': MOCK_LOGGING_LEVEL,
                'q': MOCK_SILENT_SETTING,
                'r': MOCK_DRY_RUN_SETTING,
                'd': MOCK_DATE_THESHOLD_SETTING,
                'n': MOCK_UNIT_THESHOLD_SETTING,
                'o': MOCK_DURATION_THESHOLD_SETTING,
                'k': MOCK_KEEP_THESHOLD_SETTING,
                'f': MOCK_PREFIX_FILTER_SETTING
            }
        }, yargs)
    }


});



