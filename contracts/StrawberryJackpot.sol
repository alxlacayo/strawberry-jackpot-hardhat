// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

abstract contract VRFConsumer is VRFConsumerBaseV2, Ownable {
    uint8 private constant _NUMBER_OF_WORDS = 4;

    /* solhint-disable var-name-mixedcase */
    VRFCoordinatorV2Interface public immutable _COORDINATOR;
    /* solhint-enable var-name-mixedcase */

    bytes32 public keyHash;
    uint64 public subscriptionId;
    uint16 public minimumConfirmations = 3;
    uint32 public callbackGasLimit = 100000;

    constructor(address vrfCoordinator, bytes32 _keyHash, uint64 _subscriptionId) VRFConsumerBaseV2(vrfCoordinator) {
        _COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }

    function _requestRandomWords() internal returns (uint256) {
        return _COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            minimumConfirmations,
            callbackGasLimit,
            _NUMBER_OF_WORDS
        );
    }

    function setKeyHash(bytes32 _keyHash) external onlyOwner {
        keyHash = _keyHash;
    }

    function setSubcriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setMinimumConfirmations(uint16 _minimumConfirmations) external onlyOwner {
        minimumConfirmations = _minimumConfirmations;
    }

    function setCallbackGasLimit(uint32 _callbackGasLimit) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
    }
}

contract StrawberryJackpot is VRFConsumer {
    uint256 private constant _MINIMUM_COST_PER_SPIN = 1e18;
    uint8 private constant _MINIMUM_ITEMS_PER_REEL = 10;
    bytes4 private constant _MEGA_PRIZE_NUMBERS = 0x06060606;

    /* solhint-disable var-name-mixedcase */
    IERC20Burnable private immutable _STRAWBERRY;
    /* solhint-enable var-name-mixedcase */

    uint256 public costPerSpin;
    uint8 public itemsPerReel;
    uint8 public miniPrizePercentagePoints;
    uint8 public megaPrizePercentagePoints;
    uint8 public burnPercentagePoints;

    mapping(uint256 => address) public players;

    event SpinInProgress(
        address indexed from,
        uint256 indexed requestId,
        uint256 cost,
        uint256 miniPrize,
        uint256 megaPrize,
        uint256 amountBurned
    );
    event SpinComplete(
        address indexed from,
        uint256 indexed requestId,
        bytes4 indexed numbers,
        uint256 winnings
    );

    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint64 subscriptionId,
        address strawberryAddress,
        uint256 _costPerSpin,
        uint8 _itemsPerReel,
        uint8 _miniPrizePercentagePoints,
        uint8 _megaPrizePercentagePoints,
        uint8 _burnPercentagePoints
    ) VRFConsumer(vrfCoordinator, keyHash, subscriptionId) {
        _STRAWBERRY = IERC20Burnable(strawberryAddress);
        costPerSpin = _costPerSpin;
        itemsPerReel = _itemsPerReel;
        miniPrizePercentagePoints = _miniPrizePercentagePoints;
        megaPrizePercentagePoints = _megaPrizePercentagePoints;
        burnPercentagePoints = _burnPercentagePoints;
    }

    function spin() external {
        uint256 _costPerSpin = costPerSpin;
        _STRAWBERRY.transferFrom(msg.sender, address(this), _costPerSpin);
        uint256 burnAmount = _calculatePercentage(_costPerSpin, burnPercentagePoints);
        _STRAWBERRY.burn(burnAmount);
        uint256 requestId = _requestRandomWords();
        players[requestId] = msg.sender;
        (uint256 miniPrize, uint256 megaPrize) = prizes();
        emit SpinInProgress(msg.sender, requestId, _costPerSpin, miniPrize, megaPrize, burnAmount);
    }

    function setCostPerSpin(uint256 _costPerSpin) external onlyOwner {
        require(_costPerSpin >= _MINIMUM_COST_PER_SPIN, "Too little cost per spin.");
        costPerSpin = _costPerSpin;
    }

    function setItemsPerReel(uint8 _itemsPerReel) external onlyOwner {
        require(_itemsPerReel >= _MINIMUM_ITEMS_PER_REEL, "Not enough items per reel.");
        itemsPerReel = _itemsPerReel;
    }

    function prizes() public view returns (uint256, uint256) {
        uint256 balance = _STRAWBERRY.balanceOf(address(this));
        uint256 miniPrize = _calculatePercentage(balance, miniPrizePercentagePoints);
        uint256 megaPrize = _calculatePercentage(balance, megaPrizePercentagePoints);
        return (miniPrize, megaPrize);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        bytes1 number1 = bytes1(_randomWordToNumber(randomWords[0]));
        bytes1 number2 = bytes1(_randomWordToNumber(randomWords[1]));
        bytes1 number3 = bytes1(_randomWordToNumber(randomWords[2]));
        bytes1 number4 = bytes1(_randomWordToNumber(randomWords[3]));
        bytes4 numbers = bytes4(abi.encodePacked(number1, number2, number3, number4));
        uint256 winnings = 0;
        
        if (number1 == number2 && number2 == number3 && number3 == number4) {
            (uint256 miniPrize, uint256 megaPrize) = prizes();
            winnings = numbers == _MEGA_PRIZE_NUMBERS ? megaPrize : miniPrize;
            _STRAWBERRY.transfer(players[requestId], winnings);
            // TODO: remove this console.log.
            console.log("winner %s: ", winnings);
        }

        emit SpinComplete(
            players[requestId],
            requestId,
            numbers,
            winnings
        );
        delete players[requestId];
    }

    function _calculatePercentage(uint256 value, uint8 percentagePoints) private pure returns (uint256) {
        return (value / 100) * percentagePoints;
    }

    function _randomWordToNumber(uint256 randomWord) private view returns (uint8) {
        return uint8(randomWord % itemsPerReel);
    }
}
