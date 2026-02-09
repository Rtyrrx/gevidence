// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {RoleManager} from "../../core/RoleManager.sol";
import {GEvidenceRegistry} from "../../core/GEvidenceRegistry.sol";
import {EvidenceTypes} from "../../core/EvidenceTypes.sol";

interface IVerificationCrowdfund {
    enum CampaignKind {
        CompanyOrAdmin,
        Community
    }
    struct Campaign {
        uint256 id;
        uint256 evidenceId;
        address creator;
        address beneficiary;
        CampaignKind kind;
        string title;
        uint256 goalWei;
        uint64 deadline;
        uint256 raisedWei;
        bool finalized;
        bool successful;
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory);
}

contract CompanyCertificateNFT is ERC721URIStorage {
    RoleManager public immutable roles;
    GEvidenceRegistry public immutable registry;
    IVerificationCrowdfund public immutable crowdfund;

    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint256) public evidenceOfToken;

    event CertificateMinted(
        uint256 indexed tokenId,
        uint256 indexed evidenceId,
        uint256 indexed campaignId,
        address to,
        string tokenUri
    );

    error NotAuthorized();
    error EvidenceNotFound();
    error EvidenceNotVerified();
    error CampaignMismatch();
    error CampaignNotEligible();
    error AlreadyCertified();
    error ZeroValue();

    constructor(
        address roleManager,
        address registryAddress,
        address crowdfundAddress,
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {
        require(roleManager != address(0), "CompanyCertificateNFT: zero roles");
        require(registryAddress != address(0), "CompanyCertificateNFT: zero registry");
        require(crowdfundAddress != address(0), "CompanyCertificateNFT: zero crowdfund");

        roles = RoleManager(roleManager);
        registry = GEvidenceRegistry(registryAddress);
        crowdfund = IVerificationCrowdfund(crowdfundAddress);
    }

    modifier onlyVerifierOrAdmin() {
        bool isAdmin = roles.hasRole(roles.ADMIN_ROLE(), msg.sender);
        bool isVerifier = roles.hasRole(roles.VERIFIER_ROLE(), msg.sender);
        if (!isAdmin && !isVerifier) revert NotAuthorized();
        _;
    }

    function mintCertificate(
        uint256 evidenceId,
        uint256 campaignId,
        string calldata tokenUri
    ) external onlyVerifierOrAdmin returns (uint256 tokenId) {
        if (evidenceId == 0 || campaignId == 0) revert ZeroValue();
        if (!registry.existsEvidence(evidenceId)) revert EvidenceNotFound();

        if (registry.statusOfEvidence(evidenceId) != EvidenceTypes.EvidenceStatus.Verified) {
            revert EvidenceNotVerified();
        }

        if (registry.certificateTokenOfEvidence(evidenceId) != 0) revert AlreadyCertified();

        IVerificationCrowdfund.Campaign memory c = crowdfund.getCampaign(campaignId);
        if (c.id == 0) revert CampaignNotEligible();
        if (c.evidenceId != evidenceId) revert CampaignMismatch();
        if (!c.finalized || !c.successful) revert CampaignNotEligible();

        address company = registry.companyOfEvidence(evidenceId);

        tokenId = _nextTokenId++;
        _safeMint(company, tokenId);
        _setTokenURI(tokenId, tokenUri);

        evidenceOfToken[tokenId] = evidenceId;
        registry.linkCertificate(evidenceId, tokenId);

        emit CertificateMinted(tokenId, evidenceId, campaignId, company, tokenUri);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
