# artifactory-cleanup

## Installation

```sh
$ npm install -g artifactory-cleanup
```

## Usage

```sh
artifactory-cleanup [options]

Options:
  --help                   Show help                                                                                                                [boolean]
  --version                Show version number                                                                                                      [boolean]
  -a, --artifactoryApiUrl  Artifactory server API URL                                                                                              [required]
  -u, --user               Artifactory user with permission to API                                                                                 [required]
  -q, --quiet              Quiet down output                                                                                                        [boolean]
  -t, --token              Artifactory user's generated token                                                                                      [required]
  -f, --filter             Path prefix filter
  -l, --logging            logging level                                                      [choices: "error", "warn", "info", "verbose", "debug", "silly"]
  -d, --date               Threshold date (ISO-8610 format)
  -k, --keep               Threshold to keep only nth newest artifact parent folders                                                                 [number]
  -o, --duration           Duration of time for threshold. To be combined with `unit` parameter
  -n, --unit               Unit of time for threshold. To be combined with `duration` parameter
       [choices: "years", "y", "quarters", "Q", "months", "M", "weeks", "w", "days", "d", "hours", "h", "minutes", "m", "seconds", "s", "milliseconds", "ms"]
  -r, --dryrun             Dry run of the utility. Not files will be deleted

```

## License

MIT © [Gabriel Kohen](https://github.com/gkohen)
