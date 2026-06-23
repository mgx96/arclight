// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {RevenuePool} from "../../../src/payments/RevenuePool.sol";
import {ProofOfView} from "../../../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../../../src/payments/RevenueSplitter.sol";
import {MockUSDC} from "../../mocks/MockUSDC.sol";
import {Handler} from "./Handler.sol";

contract RevenueInvariantTest is StdInvariant, Test {
    RevenuePool internal pool;
    ProofOfView internal oracle;
    RevenueSplitter internal splitter;
    MockUSDC internal usdc;
    Handler internal handler;

    address internal owner = makeAddr("owner");

    function setUp() public {
        (, uint256 attestorKey) = makeAddrAndKey("attestor");
        address attestor = vm.addr(attestorKey);
        usdc = new MockUSDC();

        vm.startPrank(owner);
        pool = new RevenuePool(address(usdc), owner);
        oracle = new ProofOfView(owner);
        splitter = new RevenueSplitter(address(pool), address(oracle));
        pool.setDistributor(address(splitter));
        oracle.setAttestor(attestor);
        oracle.setSplitter(address(splitter));
        vm.stopPrank();

        address[] memory advertisers = new address[](3);
        advertisers[0] = makeAddr("advertiserA");
        advertisers[1] = makeAddr("advertiserB");
        advertisers[2] = makeAddr("advertiserC");

        address[] memory creators = new address[](3);
        creators[0] = makeAddr("creatorA");
        creators[1] = makeAddr("creatorB");
        creators[2] = makeAddr("creatorC");

        handler = new Handler(pool, oracle, splitter, usdc, attestorKey, advertisers, creators);

        // Only fuzz through the handler so every action is a valid system interaction.
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = Handler.deposit.selector;
        selectors[1] = Handler.withdraw.selector;
        selectors[2] = Handler.setRate.selector;
        selectors[3] = Handler.distribute.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function _sumAdvertiserBalances() internal view returns (uint256 total) {
        uint256 n = handler.advertiserCount();
        for (uint256 i = 0; i < n; i++) {
            total += pool.getAdvertiserBalance(handler.advertiserAt(i));
        }
    }

    /// @dev The pool's real USDC holdings must always equal the sum of its internal advertiser budgets.
    function invariant_poolIsFullyBacked() public view {
        assertEq(usdc.balanceOf(address(pool)), _sumAdvertiserBalances());
    }

    /// @dev Internal accounting must reconcile with the lifetime ghost totals of money in and out.
    function invariant_accountingReconciles() public view {
        assertEq(
            _sumAdvertiserBalances(), handler.ghost_deposited() - handler.ghost_withdrawn() - handler.ghost_paidOut()
        );
    }

    /// @dev The pool can never owe more than it holds, so no advertiser budget is ever underwater.
    function invariant_poolNeverInsolvent() public view {
        assertGe(usdc.balanceOf(address(pool)), _sumAdvertiserBalances());
    }
}
