# artifactory-cleanup

## Installation

```sh
$ npm install -g artifactory-cleanup
```

## Usage

```sh
artifactory-cleanup [options]

Options:
  --version                                 Show version number        [boolean]
  -a, --artifactoryApiUrl,                  Artifactory server API URL
  --artifactoryApiUrl                                                 [required]
  -u, --user, --user                        Artifactory user with permission to
                                            API                       [required]
  -q, --quiet, --quiet                      Quiet down output          [boolean]
  -t, --token, --token                      Artifactory user's generated token
                                                                      [required]
  -f, --filter, --filter                    Path prefix filter
  -d, --date, --date                        Threshold date (ISO-8610 format)
  -o, --duration, --duration                Duration of time for threshold. To
                                            be combined with `unit` parameter
  -n, --unit, --unit                        Unit of time for threshold. To be
                                            combined with `duration` parameter
   [choices: "years", "y", "quarters", "Q", "months", "M", "weeks", "w", "days",
        "d", "hours", "h", "minutes", "m", "seconds", "s", "milliseconds", "ms",
        "years", "y", "quarters", "Q", "months", "M", "weeks", "w", "days", "d",
             "hours", "h", "minutes", "m", "seconds", "s", "milliseconds", "ms"]
  -r, --dryrun, --dryrun                    Dry run of the utility. Not files
                                            will be deleted
  -h                                        Show help                  [boolean]
```

## License

MIT © [Gabriel Kohen](https://github.com/gkohen)
