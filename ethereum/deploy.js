require('dotenv').config();
const { appendFileSync } = require('fs-extra');
const { resolve } = require('path');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');

const compiledFactory = require(resolve(__dirname, 'build', 'CampaignFactory.json'));
const mnemonicPhrase = process.env.PHRASE;
const url = process.env.API_URL;
const provider = new HDWalletProvider({
    mnemonic: {
        phrase: mnemonicPhrase
    },
    providerOrUrl: url
});
const web3 = new Web3(provider);

(async () => {
    const accounts = await web3.eth.getAccounts();

    console.log(`Attempting to deploy from account: ${accounts[0]}`);
    const factory = await new web3.eth.Contract(compiledFactory.abi)
        .deploy({ data: compiledFactory.evm.bytecode.object })
        .send({ from: accounts[0], gas: '2000000' });

    console.log(`Contract deployed to: ${factory.options.address}`);
    // append data to file
    try {
        appendFileSync(
            './deployed-contracts.txt', 
            `Address: ${factory.options.address}\r\nInterface: ${JSON.stringify(compiledFactory.abi)}\r\n\r\n`, 
            'utf8'
        );
    } catch (error) {
        console.log(error);
    }
    // At termination, `provider.engine.stop()' should be called to finish the process elegantly.
    provider.engine.stop();
})();
