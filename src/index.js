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
      unit: args.getThresholdUnit()
    };
    const isDryRun = !!args.isDryRun();
    const response = await proxy.getArtifacts(threshold, isDryRun);
    let shouldDelete = true;
    let deleteConfirmationAnswer;
    if (!args.isQuiet() && !isDryRun) {
      try {
        deleteConfirmationAnswer = await inquirer.prompt({
          'type': 'confirm',
          'name': 'deleteConfirmation',
          'message': chalk.whiteBright.bgRed(
            'Are you sure you want to delete the above artifacts?')
        });
      } catch (error) {
        deleteConfirmationAnswer = {deleteConfirmation: false}
      }
      shouldDelete = deleteConfirmationAnswer.deleteConfirmation;
    }
    if (shouldDelete && response.length != 0) {
      let deletedResponse = await proxy.deleteArtifacts(response, isDryRun);
      const dryrunPrefix = isDryRun ? chalk.yellowBright.bgBlue('***') : '';
      const dryRunCaption = isDryRun ? chalk.white.underline.bold('DRY RUN:') : '';
      logger.info("%s %s Total of %s artifacts were deleted using %s for a threshold of: %s and filter of %s for repositories.", dryrunPrefix,
        dryRunCaption, response.length, filesize(deletedResponse.totalSize), moment(threshold).format('LLL'),
        args.getPrefixFilter() ? args.getPrefixFilter() : 'NONE');
      if (args.getThresholdKeep()) {
        logger.info("Kept the %s newest artifacts per package",args.getThresholdKeep());
      }
    }


  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }

  function welcome() {
    console.log(chalk.yellow(figlet.textSync('Artifactory Cleanup', {horizontalLayout: 'full'})));
  }

  function registerHandlers() {
    process.on('uncaughtException', (err) => {
      console.error(`Error: ${err.message}`)
    })
  }
})();

