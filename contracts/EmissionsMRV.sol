// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EmissionsMRV {

    // the regulator administers the register
    address public regulator;

    // define the struct Facility
    struct Facility {
        string name;
        string location;
        address operator;
        bool isRegistered;
        uint256 registeredAt;
    }

    // define the struct EmissionRecord
    struct EmissionRecord {
        uint256 facilityId;
        address submittedBy;
        bytes32 dataHash;
        uint256 periodStart;
        uint256 periodEnd;
        uint256 submittedAt;
        bool verified;
        address verifiedBy;
        uint256 verifiedAt;
    }

    uint256 public facilityCount;
    uint256 public recordCount;

    mapping(uint256 => Facility) public facilities;
    mapping(uint256 => EmissionRecord) public emissionRecords;

    // facilityId
    mapping(uint256 => mapping(address => bool)) public isReporter;

    // independent auditors appointed by the regulator
    mapping(address => bool) public isVerifier;

    // every record id belonging to a facility, so auditors can pull its full history
    mapping(uint256 => uint256[]) private facilityRecords;

    // events fired whenever the register changes
    event FacilityRegistered(uint256 indexed facilityId, string name, address indexed operator);
    event ReporterUpdated(uint256 indexed facilityId, address indexed reporter, bool authorised);
    event VerifierUpdated(address indexed verifier, bool approved);
    event EmissionRecordSubmitted(
        uint256 indexed recordId,
        uint256 indexed facilityId,
        address indexed submittedBy,
        bytes32 dataHash
    );
    event EmissionRecordVerified(uint256 indexed recordId, address indexed verifiedBy);

    // access control modifiers
    modifier onlyRegulator() {
        require(msg.sender == regulator, "Only the regulator can do this");
        _;
    }

    modifier onlyVerifier() {
        require(isVerifier[msg.sender], "Only an appointed verifier can do this");
        _;
    }

    modifier onlyReporter(uint256 facilityId) {
        require(isReporter[facilityId][msg.sender], "Not an authorised reporter for this facility");
        _;
    }

    constructor() {
        regulator = msg.sender;
    }

    // register a new facility. the operator is automatically allowed to report for it.
    function registerFacility(
        string calldata name,
        string calldata location,
        address operator
    ) external onlyRegulator returns (uint256 facilityId) {
        require(bytes(name).length > 0, "Facility name required");
        require(operator != address(0), "Operator address required");

        facilityCount++;
        facilityId = facilityCount;

        facilities[facilityId] = Facility({
            name: name,
            location: location,
            operator: operator,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        isReporter[facilityId][operator] = true;

        emit FacilityRegistered(facilityId, name, operator);
        emit ReporterUpdated(facilityId, operator, true);
    }

    // appoint an independent verifier (approved = true) or remove one (approved = false)
    function setVerifier(address verifier, bool approved) external onlyRegulator {
        require(verifier != address(0), "Verifier address required");
        isVerifier[verifier] = approved;
        emit VerifierUpdated(verifier, approved);
    }

    // allow or remove a reporter for a facility
    function setReporter(uint256 facilityId, address reporter, bool authorised) external {
        require(facilities[facilityId].isRegistered, "Facility not found");
        require(
            msg.sender == regulator || msg.sender == facilities[facilityId].operator,
            "Only the regulator or facility operator can do this"
        );
        require(reporter != address(0), "Reporter address required");

        isReporter[facilityId][reporter] = authorised;
        emit ReporterUpdated(facilityId, reporter, authorised);
    }

    // submit the hash of an emissions report for a facility
    function submitEmissionRecord(
        uint256 facilityId,
        bytes32 dataHash,
        uint256 periodStart,
        uint256 periodEnd
    ) external onlyReporter(facilityId) returns (uint256 recordId) {
        require(dataHash != bytes32(0), "Report hash required");
        require(periodEnd > periodStart, "Period end must be after period start");

        recordCount++;
        recordId = recordCount;

        emissionRecords[recordId] = EmissionRecord({
            facilityId: facilityId,
            submittedBy: msg.sender,
            dataHash: dataHash,
            periodStart: periodStart,
            periodEnd: periodEnd,
            submittedAt: block.timestamp,
            verified: false,
            verifiedBy: address(0),
            verifiedAt: 0
        });

        facilityRecords[facilityId].push(recordId);

        emit EmissionRecordSubmitted(recordId, facilityId, msg.sender, dataHash);
    }

    // mark a record as independently verified
    function verifyEmissionRecord(uint256 recordId) external onlyVerifier {
        require(recordId > 0 && recordId <= recordCount, "Record not found");
        require(!emissionRecords[recordId].verified, "Record already verified");

        emissionRecords[recordId].verified = true;
        emissionRecords[recordId].verifiedBy = msg.sender;
        emissionRecords[recordId].verifiedAt = block.timestamp;

        emit EmissionRecordVerified(recordId, msg.sender);
    }

    // read functions - open to anyone

    function getFacility(uint256 facilityId) external view returns (Facility memory) {
        require(facilities[facilityId].isRegistered, "Facility not found");
        return facilities[facilityId];
    }

    function getEmissionRecord(uint256 recordId) external view returns (EmissionRecord memory) {
        require(recordId > 0 && recordId <= recordCount, "Record not found");
        return emissionRecords[recordId];
    }

    function getFacilityRecords(uint256 facilityId) external view returns (uint256[] memory) {
        return facilityRecords[facilityId];
    }
}
