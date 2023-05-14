const { resolve } = require('path');
const fs = require('fs-extra');
const solc = require('solc');

// Remove build folder, if exists
const buildPath = resolve(__dirname, 'build');
fs.removeSync(buildPath);
// Compile comtract
const campaignPath = resolve(__dirname, 'contracts', 'Campaign.sol');
const source = fs.readFileSync(campaignPath, 'utf8');
const input = {
    language: 'Solidity',
    sources: {
        'Campaign.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input))).contracts['Campaign.sol'];
for (const contract in output) {
    fs.outputJsonSync(resolve(buildPath, `${contract}.json`), output[contract]);
}
