const {
  getChangedServices,
  getRegion,
  getNotDeployedServices,
  getPackages,
  batchDeployCommand,
  batchE2ETestCommand,
  CICD,
} = require('./deployUtils');
const { error, warning, info, log } = require('./log');

const deploy = async () => {
  const argv = require('minimist')(process.argv.slice(2));
  const { stage, commitId } = argv;

  if (!stage) {
    error('Missing stage argument for deploy');
    process.exit(1);
  }
  if (stage === 'pr') {
    info('Not running deployment for stage:', stage);
    process.exit(0);
  }
  if (!commitId || !commitId.match(/\b[0-9a-f]{5,40}\b/)) {
    error('Invalid commitId argument:', commitId);
    process.exit(1);
  }

  log('Running deploy with arguments:', `stage=${stage}, commitId=${commitId}`);

  const changed = getChangedServices(commitId);
  info('Changed services:', JSON.stringify(changed));

  const region = await getRegion(stage);

  const notDeployed = await getNotDeployedServices(stage, region);

  info('Not deployed services:', JSON.stringify(notDeployed));

  if (changed.includes(CICD) || notDeployed.includes(CICD)) {
    warning(
      `If you've made changes to ${CICD} service make sure to setup it again (as a one time setup)`,
    );
  }

  const toDeploy = [...new Set([...changed, ...notDeployed])].filter(
    service => service !== CICD,
  );

  info('Services to deploy:', JSON.stringify(toDeploy));

  if (toDeploy.length > 0) {
    const packages = await getPackages();
    await batchDeployCommand(packages, toDeploy, stage);

    if (stage !== 'prod') {
      await batchE2ETestCommand(packages, toDeploy, stage);
    } else {
      info('Not running e2e tests for stage:', stage);
    }
  } else {
    info('No services to deploy');
  }
};

deploy();
