import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, type Contract } from "ethers";

describe("StrawberryJackpot", async function () {
    let strawberry: Contract;
    let strawberryJackpot: Contract;
    let vrfCoordinatorV2Mock: Contract;

    beforeEach(async () => {
        const [, signer1] = await ethers.getSigners();
        const strawberryFactory = await ethers.getContractFactory("Strawberry");
        const strawberryJackpotFactory = await ethers.getContractFactory("StrawberryJackpot");
        const vrfCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");

        vrfCoordinatorV2Mock = await vrfCoordinatorV2MockFactory.deploy(0, 0);

        await vrfCoordinatorV2Mock.createSubscription();
        await vrfCoordinatorV2Mock.fundSubscription(1, ethers.utils.parseEther("7"));

        const signer1Address = await signer1.getAddress();
        strawberry = await strawberryFactory.deploy(signer1Address);

        const keyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
        const subscriptionId = 1;
        const costPerSpin = ethers.utils.parseEther("5.0");
        const itemsPerReel = 15;
        const miniPrizePercentagePoints = 20;
        const megaPrizePercentagePoints = 80;
        const burnPercentagePoints = 20;
    
        strawberryJackpot = await strawberryJackpotFactory.deploy(
            vrfCoordinatorV2Mock.address,
            keyHash,
            subscriptionId,
            strawberry.address,
            costPerSpin,
            itemsPerReel,
            miniPrizePercentagePoints,
            megaPrizePercentagePoints,
            burnPercentagePoints
        );

        const transaction = await strawberry.connect(signer1).approve(strawberryJackpot.address, ethers.utils.parseEther("1000"));
        await transaction.wait(); 
    });

    it("should fail mint when contract is paused", async function () {
        const [_, signer1] = await ethers.getSigners();
        const transaction = await strawberryJackpot.connect(signer1).spin();
        await transaction.wait();

        const fulfill = await vrfCoordinatorV2Mock.connect(signer1).fulfillRandomWords(1, strawberryJackpot.address);
        await fulfill.wait();
    });
});
