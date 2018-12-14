
import inquirer from 'inquirer'
import figlet from 'figlet'
import chalk from 'chalk'
import moment from 'moment'

import filesize from "filesize";
import proxy from './proxy'

(async () => {
    welcome();
    const args = require('./args');
    registerHandlers();

    try {
        const logger = require('./logging');
        const threshold = args.getThresholdDate() || {
            duration: args.getThresholdDuration(),
            unit:     args.getThresholdUnit()
        };
        const response = await proxy.getArtifacts(threshold);
        let shouldDelete = true;
        let deleteConfirmationAnswer;
        const isDryRun = !!args.isDryRun();
        if (!args.isQuiet() && !isDryRun) {
            try {
                deleteConfirmationAnswer = await inquirer.prompt({
                                                                     'type':    'confirm',
                                                                     'name':    'deleteConfirmation',
                                                                     'message': chalk.whiteBright.bgRed(
                                                                         'Are you sure you want to delete the above artifacts?')
                                                                 });
            }
            catch (error) {
                deleteConfirmationAnswer = { deleteConfirmation: false }
            }
            shouldDelete = deleteConfirmationAnswer.deleteConfirmation;
        }
        if (shouldDelete && response.items.size) {
            await proxy.deleteArtifacts(response.items, isDryRun);
        }
        const dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';
        const dryRunCaption = isDryRun ? chalk.white.underline.bold('DRY RUN:') : '';

        logger.info("%s %s Total of %s were deleted for a threshold of: %s and filter of %s for repositories", dryrunPrefix,
                    dryRunCaption, filesize(response.totalSize), moment(response.thresholdTime).format('LLL'),
                    args.getPrefixFilter() ? args.getPrefixFilter() : 'NONE');

    }
    catch (error) {
        console.error(error);
        process.exitCode = 1;
    }

    function welcome() {
        console.log(chalk.yellow(figlet.textSync('Artifactory Cleanup', { horizontalLayout: 'full' })));
    }

    function registerHandlers() {
        process.on('uncaughtException', (err) => {
            console.error(`Error: ${err.message}`)
        })
    }
})();

