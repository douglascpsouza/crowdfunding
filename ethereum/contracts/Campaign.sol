// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract CampaignFactory {
    address[] public deployedCampaigns;

    function createCampaign(uint _approversContribution) public {
        Campaign newCampaign = new Campaign(msg.sender, _approversContribution);
        deployedCampaigns.push(address(newCampaign));
    }

    function getDeployedCampaigns() public view returns (address[] memory) {
        return deployedCampaigns;
    }
}

contract Campaign {
    struct Request {
        string description;
        uint value;
        address recipient;
        bool complete;
        uint approvalRating;
        mapping(address => bool) approvals;
    }

    address public manager;
    uint public approversContribution;
    uint public approversAmount;
    mapping(address => uint) public approvers;
    mapping(address => uint) public supporters;
    uint32 public numRequests;
    mapping(uint32 => Request) public requests;

    modifier restricted() {
        require(msg.sender == manager, "Manager access only");
        _;
    }

    constructor(address _creator, uint _approversContribution) {
        require(_approversContribution >= 10**15, "Approver's minimum contributon must be greater than or equal to 0.001 Ether");
        manager = _creator;
        approversContribution = _approversContribution;
    }

    function contribute() public payable {
        require(msg.value > 0, "A valid contributiom must be a positive value");
        if (msg.value >= approversContribution) {
            approvers[msg.sender] = msg.value;
            approversAmount += msg.value;
        } else {
            supporters[msg.sender] += msg.value;
            // Verify if supporter became an approver
            if (supporters[msg.sender] >= approversContribution) {
                approvers[msg.sender] = supporters[msg.sender];
                approversAmount += approvers[msg.sender];
                supporters[msg.sender] = 0;
            }
        }
    }

    function createRequest(string memory _description, uint _value, address _recipient) public restricted {
        Request storage newRequest = requests[numRequests++];
        newRequest.description = _description;
        newRequest.value = _value;
        newRequest.recipient = _recipient;
        newRequest.complete = false;
        newRequest.approvalRating = 0;
    }

    function approveRequest(uint32 _requestNumber, bool _approved) public {
        Request storage request = requests[_requestNumber];
        require(approvers[msg.sender] >= approversContribution, "Approvers access only!");
        require(request.approvals[msg.sender] != _approved, "Approval vote already recorded");
        request.approvals[msg.sender] = _approved;
        if (_approved) {
            request.approvalRating += approvers[msg.sender];
        } else {
            request.approvalRating -= approvers[msg.sender];
        }
    }

    function finalizeRequest(uint32 _requestNumber) public restricted {
        Request storage request = requests[_requestNumber];
        require(!request.complete, "Request is already completed");
        require(request.approvalRating > (approversAmount / 2), "Approval rating must be grater than 50%");
        payable(request.recipient).transfer(request.value);
        request.complete = true;
    }
}
