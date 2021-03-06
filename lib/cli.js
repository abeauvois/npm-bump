'use strict';

const fs = require('fs');
const replace = require('replace');
const execSync = require('child_process').execSync;
const semver = require('semver');
const inquirer = require('inquirer');
const shellQuote = require('shell-quote');

const createNpmBump = (remoteName, branch) => {
    remoteName = remoteName || 'origin';
    branch = branch || 'master';

    const UsageError = class extends Error {
        constructor(message) {
            super(message);
            this.name = 'UsageError';
        }
    };

    return releaseType => {
        const isPrerelease = ['major', 'minor', 'patch'].indexOf(releaseType) === -1;

        const getHashFor = branchName => {
            try {
                return run(`git rev-parse --verify ${ quote(branchName) }`).trim();
            } catch (error) {
                throw new UsageError(`Git couldn't find the branch: "${ branchName
                    }"; please ensure it exists`);
            }
        };

        const ensureCleanBranch = () => {
            if (getHashFor('HEAD') !== getHashFor(branch)) {
                throw new UsageError(`You need to be on the "${ branch
                    }" branch to run this script`);
            }
            // if (getHashFor(branch) !== getHashFor(`${ remoteName }/${ branch }`)) {
            //     throw new UsageError('You need to push your changes first');
            // }
            if (run('git status -s').length) {
                throw new UsageError(
                    'You have uncommited changes! Commit them before running this script');
            }
        };

        const getRootPath = () => run('git rev-parse --show-cdup').trim();
        const getPackageJsonPath = () => `${ process.cwd() }/${ getRootPath() }package.json`;
        const quote = string => shellQuote.quote([string]);
        const run = command => execSync(command, {encoding: 'utf8'});
        const writePackageJson = (configObject) => {
            const filename = getPackageJsonPath()
            fs.writeFileSync(filename,`${ JSON.stringify(configObject, null, 2) }\n`);
            console.log('grep package.json', run(`grep "version" ${ filename }`).trim().toString());
        }
        const setNewVersion = (newVersion) => {
          const filename = './src/containers/projectsScreen.js'
          // console.log('setNewVersion:', newVersion, 'to ', filename);
          replace({
            regex: ">v[0-9].[0-9].[0-9]",
            replacement: '>v' + newVersion,
            paths: [filename],
            recursive: false,
            silent: true,
          });
          console.log('grep result', run(`grep ">v" ${ filename }`).trim().toString());
          // run(`grep ">v" ${ filename }`);
        }
        const doBump = () => {
            const packageJson = require(getPackageJsonPath());
            const oldVersion = packageJson.version;

            // Tag a new release
            // const newStableVersion = packageJson.version = isPrerelease ?
                // semver.inc(oldVersion, 'pre', releaseType) :
            const newStableVersion = packageJson.version = semver.inc(oldVersion, releaseType);
            writePackageJson(packageJson);
            setNewVersion(newStableVersion);

            // console.log('setNewVersion:', newVersion);
            console.log(`Version bumped from ${ oldVersion } to ${ newStableVersion }`);
            run(`git add ${ quote(getPackageJsonPath()) }`);
            run(`git commit -m ${ quote(`Tag ${ newStableVersion }`) }`);
            run(`git tag ${ quote(newStableVersion) }`);

            // Bump to a new pre-release version but only if the version to publish is not
            // itself a pre-release; otherwise semver gets confused.
            // if (!isPrerelease) {
            //     packageJson.version = `${ semver.inc(packageJson.version, 'patch') }-pre`;
            //     writePackageJson(packageJson);
            //     run(`git add ${ quote(getPackageJsonPath()) }`);
            //     run(`git commit -m ${ quote(`Bump to ${ packageJson.version }`) }`);
            // }

            // All public changes are done here.
            inquirer.prompt([{
                name: 'shouldProceed',
                type: 'confirm',
                message: 'Are you sure you want to publish the new version?',
            }], answers => {
                if (answers.shouldProceed) {
                    // Push & publish the tag.
                    // run(`git checkout ${ quote(newStableVersion) } 2>/dev/null`);
                    // run(`npm publish ${ quote(getRootPath()) }${
                    //     isPrerelease ? ` --tag ${ quote(releaseType) }` : '' }`
                    // );
                    // run(`git push ${ quote(remoteName) } ${ quote(newStableVersion) }`);
                    //
                    // // Push the latest commit.
                    // run(`git checkout ${ quote(branch) } 2>/dev/null`);
            
                    if (!isPrerelease) {
                        // Force-update the date to prevent two commits having the same time stamp.
                        const commitMsg = run('git show -s --format=%s');
                        run('git reset --soft HEAD^');
                        run(`git commit -m ${ quote(commitMsg) }`);
                    }

                    run(`git push ${ quote(remoteName) } ${ quote(branch) }`);
                } else {
                    run(`git tag -d ${ quote(newStableVersion) }`);
                    run(`git reset --hard HEAD~1`);
                    console.log('Changes reverted');
                }
            });
        };

        ensureCleanBranch();
        doBump();
    };
};

module.exports = createNpmBump('origin', 'master');
module.exports.custom = createNpmBump;
