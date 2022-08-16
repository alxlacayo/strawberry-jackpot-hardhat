// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through "node <script>".
//
// When running the script with "npx hardhat run <script>" you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import fs from "fs";
import path from "path";
import hre, { ethers } from "hardhat";
import { BigNumber } from "ethers";
import type { TransactionResponse } from "@ethersproject/abstract-provider";

async function main() {
    const provider = new hre.ethers.providers.JsonRpcProvider(process.env.POLYGON_MUMBAI_RPC_URL);

    let signer = new hre.ethers.Wallet(process.env.PRIVATE_KEY!);
    signer = signer.connect(provider);
    const signerAddress = await signer.getAddress();

    const strawberryFactory = await hre.ethers.getContractFactory("Strawberry");
    const strawberry = await strawberryFactory.deploy(signerAddress);
    await strawberry.deployed();
    console.log(`Strawberry address: ${strawberry.address}`);

    const strawberryJackpotFactory = await hre.ethers.getContractFactory("StrawberryJackpot");
    const vrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed";
    const keyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
    const subscriptionId = 1261;
    const costPerSpin = hre.ethers.utils.parseEther("5.0");
    const itemsPerReel = 15;
    const miniPrizePercentagePoints = 20;
    const megaPrizePercentagePoints = 80;
    const burnPercentagePoints = 20;

    const strawberryJackpot = await strawberryJackpotFactory.deploy(
        vrfCoordinator,
        keyHash,
        subscriptionId,
        strawberry.address,
        costPerSpin,
        itemsPerReel,
        miniPrizePercentagePoints,
        megaPrizePercentagePoints,
        burnPercentagePoints
    );
    await strawberryJackpot.deployed();
    console.log(`Strawberry jackpot address: ${strawberryJackpot.address}`);

    // const transaction = await strawberryJackpot.coordinator.createSubscription() as TransactionResponse;
    // const receipt = await transaction.wait();

    const strawberryTransfer = await strawberry.connect(signer).transfer(
        strawberryJackpot.address,
        hre.ethers.utils.parseEther("20"),
        { gasPrice: ethers.utils.parseUnits("200", "gwei") }
    ) as TransactionResponse;

    await strawberryTransfer.wait();

    console.log("Strawberry transferred.");

    saveContractAddresses(strawberryJackpot.address, strawberry.address);
    saveStrawberryJackpotAbi();

    setTimeout(async () => {
        try {
            await verifyContract(
                strawberryJackpot.address,
                vrfCoordinator,
                keyHash,
                subscriptionId,
                strawberry.address,
                costPerSpin,
                itemsPerReel,
                miniPrizePercentagePoints,
                megaPrizePercentagePoints,
                burnPercentagePoints
            );
        } catch (error: any) {
            console.log(error);
        }

        try {
            await verifyContract(
                strawberry.address,
                signerAddress
            );
        } catch (error: any) {
            console.log(error);
        }
    }, 60000);
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
        addresses[hre.network.name] = {
            ...addresses[hre.network.name],
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
        const writePath = path.join(__dirname, "/../../frontend/src/config/strawberryJackpotInterface.json");
        const { abi } = JSON.parse(fs.readFileSync(readPath, "utf8"));
        fs.writeFileSync(writePath, JSON.stringify(abi));
    } catch (error) {
        console.log(error);
    }
}

function verifyContract(address: string, ...constructorArguments: any[]): Promise<any> {
    return hre.run("verify:verify", { address, constructorArguments });
}
