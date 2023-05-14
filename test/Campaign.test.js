const assert = require('assert');
const ganache = require('ganache');
const Web3 = require('web3');
const { beforeEach, describe, it } = require('mocha');
const compiledFactory = require('../ethereum/build/CampaignFactory.json');
const compiledCampaign = require('../ethereum/build/Campaign.json');

const web3 = new Web3(ganache.provider());

let accounts;
let factory;
let campaign;
let campaignAddress;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    factory = await new web3.eth.Contract(compiledFactory.abi)
        .deploy({ data: compiledFactory.evm.bytecode.object })
        .send({ from: accounts[0], gas: '2000000' });

    await factory.methods.createCampaign('2000000000000000').send({ // 0.002 Ether or 2 Finney
        from: accounts[0],
        gas: '2000000'
    });

    [campaignAddress] = await factory.methods.getDeployedCampaigns().call();
    campaign = await new web3.eth.Contract(compiledCampaign.abi, campaignAddress);
});

describe('Crowdfunding Campaigns', () => {
    it('deploys factory and campaign contracts', () => {
        assert.ok(factory.options.address);
        assert.ok(campaign);
    });

    it('marks caller as the campaign manager', async () => {
        const manager = await campaign.methods.manager().call();
        assert.equal(accounts[0], manager);
    });

    it('verifies approver contribution', async () => {
        const approversContribution = await campaign.methods.approversContribution().call();
        assert.equal('2000000000000000', approversContribution);
    });

    it('tries to start a campaign with amount for approvers below the minimum', async () => {
        try {
            await factory.methods.createCampaign('900000000000000').send({ // 0.9 Finney
                from: accounts[1],
                gas: 2000000
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('tries to contribute to a campaign with zero Wei', async () => {
        try {
            await campaign.methods.contribute().send({
                from: accounts[1],
                gas: 1000000,
                value: 0
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('makes a contribution below the level of approvers and becomes a supporter', async () => {
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('0.5', 'finney')
        });
        const supporterAmount = await campaign.methods.supporters(accounts[1]).call();
        const totalApproverAmount = await campaign.methods.approversAmount().call();
        assert.equal('500000000000000', supporterAmount);
        assert.equal('0', totalApproverAmount);
    });

    it('makes a second contribution and becomes an approver', async () => {
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('0.5', 'finney')
        });
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('1.5', 'finney')
        });
        const supporterAmount = await campaign.methods.supporters(accounts[1]).call();
        const approverAmount = await campaign.methods.approvers(accounts[1]).call();
        const totalApproverAmount = await campaign.methods.approversAmount().call();
        assert.equal('0', supporterAmount);
        assert.equal('2000000000000000', approverAmount);
        assert.equal('2000000000000000', totalApproverAmount);
    });

    it('makes a contribution to become an approver', async () => {
        await campaign.methods.contribute().send({
            from: accounts[2],
            gas: 1000000,
            value: web3.utils.toWei('2', 'finney')
        });
        const supporterAmount = await campaign.methods.supporters(accounts[2]).call();
        const approverAmount = await campaign.methods.approvers(accounts[2]).call();
        const totalApproverAmount = await campaign.methods.approversAmount().call();
        assert.equal('0', supporterAmount);
        assert.equal('2000000000000000', approverAmount);
        assert.equal('2000000000000000', totalApproverAmount);
    });

    it('tries to create a request - not the manager', async () => {
        try {
            await campaign.methods.createRequest(
                'Hire an accountant',
                web3.utils.toWei('1', 'finney'),
                accounts[2]
            ).send({ from: accounts[1], gas: 1000000 });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('manager creates a request', async () => {
        await campaign.methods.createRequest(
            'Hire an accountant',
            web3.utils.toWei('1', 'finney'),
            accounts[2]
        ).send({ from: accounts[0], gas: 1000000 });

        const request = await campaign.methods.requests(0).call();
        assert.equal('Hire an accountant', request.description);
        assert.equal(accounts[2], request.recipient);
    });

    it('supporter tries to approve a request', async () => {
        // contributes and becomes a supporter (not approver)
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('0.5', 'finney')
        });
        // manager creates request
        await campaign.methods.createRequest(
            'Hire an accountant',
            web3.utils.toWei('1', 'finney'),
            accounts[2]
        ).send({ from: accounts[0], gas: 1000000 });
        // supporter tries to approve it
        try {
            await campaign.methods.approveRequest(0, true).send({
                from: accounts[1],
                gas: 1000000
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('approver votes to approve a request', async () => {
        // contributes and becomes an approver
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('2', 'finney')
        });
        // manager creates request
        await campaign.methods.createRequest(
            'Hire an accountant',
            web3.utils.toWei('1', 'finney'),
            accounts[2]
        ).send({ from: accounts[0], gas: 1000000 });
        // approver votes to approve it
        await campaign.methods.approveRequest(0, true).send({
            from: accounts[1],
            gas: 1000000
        });
    });

    it('manager tries to finalize a request before approvement', async () => {
        // manager creates request
        await campaign.methods.createRequest(
            'Hire an accountant',
            web3.utils.toWei('1', 'finney'),
            accounts[2]
        ).send({ from: accounts[0], gas: 1000000 });
        // manager tries to finalize it
        try {
            await campaign.methods.finalizeRequest(0).send({
                from: accounts[0],
                gas: 1000000
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('manager finalizes an approved request', async () => {
        // manager creates a request
        await campaign.methods.createRequest(
            'Hire an accountant',
            web3.utils.toWei('1', 'finney'),
            accounts[2]
        ).send({ from: accounts[0], gas: 1000000 });
        // someone contributes and becomes an approver
        await campaign.methods.contribute().send({
            from: accounts[1],
            gas: 1000000,
            value: web3.utils.toWei('2', 'finney')
        });
        // approver votes to approve it
        await campaign.methods.approveRequest(0, true).send({
            from: accounts[1],
            gas: 1000000
        });

        // manager finalizes the request
        const balanceBeforeTranfer = await web3.eth.getBalance(accounts[2]);
        await campaign.methods.finalizeRequest(0).send({
            from: accounts[0],
            gas: 1000000
        });
        const request = await campaign.methods.requests(0).call();

        const balanceAfterTransfer = await web3.eth.getBalance(accounts[2]);
        const balance = parseFloat(web3.utils.fromWei(balanceAfterTransfer, 'ether')) -
                        parseFloat(web3.utils.fromWei(balanceBeforeTranfer, 'ether'));
        console.log(balance);

        assert.equal(true, request.complete);
    });
});
