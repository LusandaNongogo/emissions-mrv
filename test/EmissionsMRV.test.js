// Tests for EmissionsMRV.sol
// Run with: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EmissionsMRV", function () {
  let mrv, regulator, operator, sensor, verifier, stranger;

  // a sample report hash, as if we had hashed an emissions report document
  const reportHash = ethers.keccak256(ethers.toUtf8Bytes("emissions-report-q1-2026"));
  const periodStart = 1735689600; // 1 Jan 2025
  const periodEnd = 1743465600;   // 1 Apr 2025

  beforeEach(async function () {
    [regulator, operator, sensor, verifier, stranger] = await ethers.getSigners();
    const EmissionsMRV = await ethers.getContractFactory("EmissionsMRV");
    mrv = await EmissionsMRV.deploy();
    await mrv.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the deployer as the regulator", async function () {
      expect(await mrv.regulator()).to.equal(regulator.address);
    });
  });

  describe("Registering facilities", function () {
    it("lets the regulator register a facility", async function () {
      await expect(mrv.registerFacility("Plant A", "Ekurhuleni", operator.address))
        .to.emit(mrv, "FacilityRegistered")
        .withArgs(1, "Plant A", operator.address);

      const facility = await mrv.getFacility(1);
      expect(facility.name).to.equal("Plant A");
      expect(facility.operator).to.equal(operator.address);
      expect(facility.isRegistered).to.equal(true);
    });

    it("makes the operator a reporter for its own facility", async function () {
      await mrv.registerFacility("Plant A", "Ekurhuleni", operator.address);
      expect(await mrv.isReporter(1, operator.address)).to.equal(true);
    });

    it("blocks anyone other than the regulator", async function () {
      await expect(
        mrv.connect(stranger).registerFacility("Plant A", "Ekurhuleni", operator.address)
      ).to.be.revertedWith("Only the regulator can do this");
    });

    it("rejects an empty facility name", async function () {
      await expect(
        mrv.registerFacility("", "Ekurhuleni", operator.address)
      ).to.be.revertedWith("Facility name required");
    });

    it("rejects a zero operator address", async function () {
      await expect(
        mrv.registerFacility("Plant A", "Ekurhuleni", ethers.ZeroAddress)
      ).to.be.revertedWith("Operator address required");
    });
  });

  describe("Managing reporters", function () {
    beforeEach(async function () {
      await mrv.registerFacility("Plant A", "Ekurhuleni", operator.address);
    });

    it("lets the facility operator authorise a sensor wallet", async function () {
      await expect(mrv.connect(operator).setReporter(1, sensor.address, true))
        .to.emit(mrv, "ReporterUpdated")
        .withArgs(1, sensor.address, true);

      expect(await mrv.isReporter(1, sensor.address)).to.equal(true);
    });

    it("lets a reporter be removed again", async function () {
      await mrv.connect(operator).setReporter(1, sensor.address, true);
      await mrv.connect(operator).setReporter(1, sensor.address, false);
      expect(await mrv.isReporter(1, sensor.address)).to.equal(false);
    });

    it("blocks an unrelated address from authorising reporters", async function () {
      await expect(
        mrv.connect(stranger).setReporter(1, sensor.address, true)
      ).to.be.revertedWith("Only the regulator or facility operator can do this");
    });

    it("rejects an unknown facility", async function () {
      await expect(
        mrv.setReporter(99, sensor.address, true)
      ).to.be.revertedWith("Facility not found");
    });
  });

  describe("Submitting emission records", function () {
    beforeEach(async function () {
      await mrv.registerFacility("Plant A", "Ekurhuleni", operator.address);
      await mrv.connect(operator).setReporter(1, sensor.address, true);
    });

    it("lets an authorised reporter submit a record", async function () {
      await expect(
        mrv.connect(sensor).submitEmissionRecord(1, reportHash, periodStart, periodEnd)
      )
        .to.emit(mrv, "EmissionRecordSubmitted")
        .withArgs(1, 1, sensor.address, reportHash);

      const record = await mrv.getEmissionRecord(1);
      expect(record.dataHash).to.equal(reportHash);
      expect(record.facilityId).to.equal(1);
      expect(record.submittedBy).to.equal(sensor.address);
      expect(record.verified).to.equal(false);
    });

    it("adds the record to the facility's history", async function () {
      await mrv.connect(sensor).submitEmissionRecord(1, reportHash, periodStart, periodEnd);
      const ids = await mrv.getFacilityRecords(1);
      expect(ids.map(Number)).to.deep.equal([1]);
    });

    it("blocks an unauthorised address", async function () {
      await expect(
        mrv.connect(stranger).submitEmissionRecord(1, reportHash, periodStart, periodEnd)
      ).to.be.revertedWith("Not an authorised reporter for this facility");
    });

    it("rejects an empty report hash", async function () {
      await expect(
        mrv.connect(sensor).submitEmissionRecord(1, ethers.ZeroHash, periodStart, periodEnd)
      ).to.be.revertedWith("Report hash required");
    });

    it("rejects a reporting period that ends before it starts", async function () {
      await expect(
        mrv.connect(sensor).submitEmissionRecord(1, reportHash, periodEnd, periodStart)
      ).to.be.revertedWith("Period end must be after period start");
    });
  });

  describe("Verifying records", function () {
    beforeEach(async function () {
      await mrv.registerFacility("Plant A", "Ekurhuleni", operator.address);
      await mrv.setVerifier(verifier.address, true);
      await mrv.connect(operator).submitEmissionRecord(1, reportHash, periodStart, periodEnd);
    });

    it("lets an appointed verifier verify a record", async function () {
      await expect(mrv.connect(verifier).verifyEmissionRecord(1))
        .to.emit(mrv, "EmissionRecordVerified")
        .withArgs(1, verifier.address);

      const record = await mrv.getEmissionRecord(1);
      expect(record.verified).to.equal(true);
      expect(record.verifiedBy).to.equal(verifier.address);
    });

    it("does not change the originally submitted data", async function () {
      const before = await mrv.getEmissionRecord(1);
      await mrv.connect(verifier).verifyEmissionRecord(1);
      const after = await mrv.getEmissionRecord(1);

      expect(after.dataHash).to.equal(before.dataHash);
      expect(after.submittedBy).to.equal(before.submittedBy);
      expect(after.submittedAt).to.equal(before.submittedAt);
    });

    it("blocks an address that is not a verifier", async function () {
      await expect(
        mrv.connect(stranger).verifyEmissionRecord(1)
      ).to.be.revertedWith("Only an appointed verifier can do this");
    });

    // Note: this passes because the operator has not been appointed a verifier, not
    // because the contract forbids self-verification. Nothing stops the regulator
    // appointing a submitter as a verifier - see the report's Part D.1.
    it("blocks the facility operator while it is not an appointed verifier", async function () {
      await expect(
        mrv.connect(operator).verifyEmissionRecord(1)
      ).to.be.revertedWith("Only an appointed verifier can do this");
    });

    it("rejects verifying the same record twice", async function () {
      await mrv.connect(verifier).verifyEmissionRecord(1);
      await expect(
        mrv.connect(verifier).verifyEmissionRecord(1)
      ).to.be.revertedWith("Record already verified");
    });

    it("rejects an unknown record", async function () {
      await expect(
        mrv.connect(verifier).verifyEmissionRecord(99)
      ).to.be.revertedWith("Record not found");
    });

    it("stops working once the verifier is removed", async function () {
      await mrv.setVerifier(verifier.address, false);
      await expect(
        mrv.connect(verifier).verifyEmissionRecord(1)
      ).to.be.revertedWith("Only an appointed verifier can do this");
    });
  });
});
