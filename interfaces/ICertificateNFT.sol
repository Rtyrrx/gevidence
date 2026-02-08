// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICertificateNFT
 * @notice Minimal interface for CompanyCertificateNFT used by modules + frontend
 */
interface ICertificateNFT {
    function nextTokenId() external view returns (uint256);

    function evidenceOfToken(uint256 tokenId) external view returns (uint256);

    function mintCertificate(
        uint256 evidenceId,
        uint256 campaignId,
        string calldata tokenUri
    ) external returns (uint256 tokenId);

    // Common ERC-721 reads (frontend often uses these)
    function ownerOf(uint256 tokenId) external view returns (address);

    function tokenURI(uint256 tokenId) external view returns (string memory);
}