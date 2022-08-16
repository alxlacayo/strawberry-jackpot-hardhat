// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through "node <script>".
//
// When running the script with "npx hardhat run <script>" you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

async function main() {
    const [_, signer1] = await ethers.getSigners();
    const strawberryFactory = await ethers.getContractFactory("Strawberry");
    const strawberryJackpotFactory = await ethers.getContractFactory("StrawberryJackpot");
    const vrfCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");

    const vrfCoordinatorV2Mock = await vrfCoordinatorV2MockFactory.deploy(0, 0);

    await vrfCoordinatorV2Mock.createSubscription();
    await vrfCoordinatorV2Mock.fundSubscription(1, ethers.utils.parseEther("7"));

    const signer1Address = await signer1.getAddress();
    const strawberry = await strawberryFactory.deploy(signer1Address);

    const subscriptionId = 1;
    const costPerSpin = ethers.utils.parseEther("5.0");
    const numberOfItemsPerReel = 15;
    const miniPrizePercentagePoints = 20;
    const megaPrizePercentagePoints = 80;
    const burnPercentagePoints = 20;

    const strawberryJackpot = await strawberryJackpotFactory.deploy(
        vrfCoordinatorV2Mock.address,
        subscriptionId,
        strawberry.address,
        costPerSpin,
        numberOfItemsPerReel,
        miniPrizePercentagePoints,
        megaPrizePercentagePoints,
        burnPercentagePoints
    );

    const strawberryTransfer = await strawberry.connect(signer1).transfer(strawberryJackpot.address, ethers.utils.parseEther("100"));
    await strawberryTransfer.wait();

    saveContractAddresses(strawberryJackpot.address, strawberry.address);
    saveStrawberryJackpotAbi();
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });

function saveContractAddresses(strawberryJackpotAddress: string, strawberryAddress: string | undefined): void {
    try {
        const filePath = path.join(__dirname, "/../../frontend/src/config/addresses.json");
        const addresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
        addresses[network.name] = {
            ...addresses[network.name],
            strawberryAddress,
            strawberryJackpotAddress
        };
        fs.writeFileSync(filePath, JSON.stringify(addresses));
    } catch (error) {
        console.log(error);
    }
}

function saveStrawberryJackpotAbi(): void {
    try {
        const readPath = path.join(__dirname, "/../artifacts/contracts/StrawberryJackpot.sol/StrawberryJackpot.json");
        const writePath = path.join(__dirname, "/../../frontend/src/config/strawberryJackpotAbi.json");
        const { abi } = JSON.parse(fs.readFileSync(readPath, "utf8"));
        fs.writeFileSync(writePath, JSON.stringify(abi));
    } catch (error) {
        console.log(error);
    }
}