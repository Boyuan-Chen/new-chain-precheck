const ethers = require('ethers');
const ethSigUtil = require('eth-sig-util')
const { sleep } = require('@eth-optimism/core-utils');

const L1ERC20Json = require("./abi/L1ERC20.json");
const L1StandardBridgeJson = require("./abi/L1StandardBridge.json");
const Boba_GasPriceOracleJson = require("./abi/Boba_GasPriceOracle.json")
const L2_L1NativeTokenJson = require("./abi/L2_L1NativeToken.json")

require('dotenv').config();

const env = process.env;
const L1_NODE_WEB3_URL = env.L1_NODE_WEB3_URL || "http://localhost:9545";
const L2_NODE_WEB3_URL = env.L2_NODE_WEB3_URL || "http://localhost:8545";
const PRIAVTE_KEY = env.PRIVATE_KEY
const L1_BOBA_ADDRESS = env.L1_BOBA_ADDRESS
const L1_STANDARD_BRIDGE_ADDRESS = env.L1_STANDARD_BRIDGE_ADDRESS

const main = async() => {

  const L1Web3 = new ethers.providers.JsonRpcProvider(L1_NODE_WEB3_URL);
  const L1Wallet = new ethers.Wallet(PRIAVTE_KEY).connect(L1Web3);

  const L2Web3 = new ethers.providers.JsonRpcProvider(L2_NODE_WEB3_URL);
  const L2Wallet = new ethers.Wallet(PRIAVTE_KEY).connect(L2Web3);

  const L1_BOBA = new ethers.Contract(
    L1_BOBA_ADDRESS,
    L1ERC20Json.abi,
    L1Wallet
  )
  const L1StandardBridge = new ethers.Contract(
    L1_STANDARD_BRIDGE_ADDRESS,
    L1StandardBridgeJson.abi,
    L1Wallet
  )

  const L2_L1NativeToken = new ethers.Contract(
    '0x4200000000000000000000000000000000000023',
    L2_L1NativeTokenJson.abi,
    L2Wallet
  )

  const Boba_GasPriceOracle = new ethers.Contract(
    '0x4200000000000000000000000000000000000024',
    Boba_GasPriceOracleJson.abi,
    L2Wallet
  )


  const approveTx = await L1_BOBA.approve(
    L1StandardBridge.address,
    ethers.utils.parseEther('100'),
  )
  await approveTx.wait()

  const transferTx = await L1StandardBridge.depositERC20(
    L1_BOBA.address,
    '0x4200000000000000000000000000000000000006',
    ethers.utils.parseEther('100'),
    300_000,
    '0x'
  )
  await transferTx.wait()

  const preBalance = (await L2Wallet.getBalance()).toString()

  while ((await L2Wallet.getBalance()).toString() === preBalance) {
    await sleep(5000)
    console.log('Still waiting....')
  }

  console.log("L2 BOBA balance:", (await L2Wallet.getBalance()).toString())

  await L1StandardBridge.depositNativeToken(
    300_000,
    '0x',
    { value: ethers.utils.parseEther('0.1')}
  )

  const preL1NativeTokenBalance = (await L2_L1NativeToken.balanceOf(L2Wallet.address)).toString()

  while ((await L2_L1NativeToken.balanceOf(L2Wallet.address)).toString() === preL1NativeTokenBalance) {
    await sleep(5000)
    console.log('Still waiting....')
  }

  console.log("L1 Native Token balance:", (await L2_L1NativeToken.balanceOf(L2Wallet.address)).toString())

  EIP712Domain = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ]
  Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ]

  name = await L2_L1NativeToken.name()
  version = '1'
  chainId = (await L2Web3.getNetwork()).chainId

  const owner = L2Wallet.address
  const spender = Boba_GasPriceOracle.address
  const value = 1
  const nonce = (await L2_L1NativeToken.nonces(L2Wallet.address)).toNumber()
  const deadline = Math.floor(Date.now() / 1000) + 900
  const verifyingContract = L2_L1NativeToken.address

  const data = {
    primaryType: 'Permit',
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: { owner, spender, value, nonce, deadline },
  }

  const signature = ethSigUtil.signTypedData(
    Buffer.from(L2Wallet.privateKey.slice(2), 'hex'),
    { data }
  )

  const sig = ethers.utils.splitSignature(signature)

  console.log(ethSigUtil.recoverTypedMessage({ data, sig:signature }))

  await L2_L1NativeToken.permit(
    owner,
    spender,
    value,
    deadline,
    sig.v,
    sig.r,
    sig.s
  )
  console.log(await L2_L1NativeToken.allowance(L2Wallet.address, Boba_GasPriceOracle.address))
}

main()