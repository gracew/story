function checkRequiredEnvVars(requiredEnvVars) {
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        console.error(`${envVar} env var is required`);
        process.exit(1);
      }
    });
  }

  exports.checkRequiredEnvVars = checkRequiredEnvVars;
