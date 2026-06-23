// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r =
        21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617;
    // Base field size
    uint256 constant q =
        21_888_242_871_839_275_222_246_405_745_257_275_088_696_311_157_297_823_662_689_037_894_645_226_208_583;

    // Verification Key data
    uint256 constant alphax =
        3_402_522_527_071_074_827_125_606_245_761_175_317_886_851_181_026_133_057_198_286_613_200_660_606_572;
    uint256 constant alphay =
        20_683_228_137_640_439_961_872_875_279_886_596_821_323_620_053_540_812_110_119_420_926_809_678_500_119;
    uint256 constant betax1 =
        12_697_678_576_844_651_920_818_834_117_619_270_025_026_920_919_866_732_943_256_928_188_786_146_093_829;
    uint256 constant betax2 =
        19_785_932_012_009_898_625_983_253_149_890_731_108_430_529_471_762_951_325_192_020_621_122_859_972_979;
    uint256 constant betay1 =
        14_747_767_366_295_981_241_541_907_389_780_170_581_993_951_164_191_119_970_103_815_574_110_551_305_313;
    uint256 constant betay2 =
        7_904_380_445_195_282_092_550_201_893_661_587_011_049_041_125_028_897_701_781_928_537_435_417_332_997;
    uint256 constant gammax1 =
        11_559_732_032_986_387_107_991_004_021_392_285_783_925_812_861_821_192_530_917_403_151_452_391_805_634;
    uint256 constant gammax2 =
        10_857_046_999_023_057_135_944_570_762_232_829_481_370_756_359_578_518_086_990_519_993_285_655_852_781;
    uint256 constant gammay1 =
        4_082_367_875_863_433_681_332_203_403_145_435_568_316_851_327_593_401_208_105_741_076_214_120_093_531;
    uint256 constant gammay2 =
        8_495_653_923_123_431_417_604_973_247_489_272_438_418_190_587_263_600_148_770_280_649_306_958_101_930;
    uint256 constant deltax1 =
        8_421_158_793_678_948_580_626_418_424_387_681_925_996_490_259_517_001_282_510_627_847_966_385_944_039;
    uint256 constant deltax2 =
        8_552_457_208_610_291_023_998_622_774_773_569_688_241_318_151_422_432_264_490_431_360_643_675_325_014;
    uint256 constant deltay1 =
        15_114_396_561_249_483_747_399_738_565_861_351_568_380_335_618_499_683_576_387_226_130_872_107_084_995;
    uint256 constant deltay2 =
        125_327_315_311_257_229_447_222_617_064_811_466_471_616_674_708_167_296_357_770_994_539_794_233_427;

    uint256 constant IC0x =
        13_295_131_913_849_166_810_223_643_785_052_817_016_561_593_394_210_626_751_728_292_046_826_467_599_181;
    uint256 constant IC0y =
        12_602_055_051_726_944_795_142_287_558_303_865_589_024_803_088_750_135_867_664_363_905_913_816_853_360;

    uint256 constant IC1x =
        294_994_359_616_560_929_428_703_696_750_723_989_579_131_762_008_208_757_411_328_447_316_588_585_924;
    uint256 constant IC1y =
        1_615_467_892_182_849_370_313_629_325_410_676_506_643_481_393_347_807_259_036_040_408_050_894_267_489;

    uint256 constant IC2x =
        8_777_631_549_880_901_740_147_774_610_845_619_364_485_116_351_438_140_986_075_675_715_803_983_059_880;
    uint256 constant IC2y =
        11_557_813_931_307_191_832_971_143_734_735_525_199_038_258_367_148_631_820_160_136_212_425_012_062_820;

    uint256 constant IC3x =
        1_932_576_149_875_389_098_587_625_531_828_050_202_406_691_834_249_979_202_470_626_016_553_521_149_155;
    uint256 constant IC3y =
        7_623_543_991_907_514_476_235_222_789_819_875_927_405_174_726_063_548_265_997_595_715_441_735_665_933;

    uint256 constant IC4x =
        19_327_346_248_193_101_503_079_353_687_488_643_184_500_264_624_590_397_433_201_449_656_965_104_225_080;
    uint256 constant IC4y =
        10_683_285_336_440_574_563_581_665_813_402_600_573_503_117_139_905_506_389_718_359_688_192_313_260_707;

    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x

                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))

                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))

                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))

                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))

                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)

                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F

            checkField(calldataload(add(_pubSignals, 0)))

            checkField(calldataload(add(_pubSignals, 32)))

            checkField(calldataload(add(_pubSignals, 64)))

            checkField(calldataload(add(_pubSignals, 96)))

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
            return(0, 0x20)
        }
    }
}
