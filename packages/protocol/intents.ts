import {
  hashTypedData,
  keccak256,
  concat,
  toHex,
  recoverTypedDataAddress,
  parseSignature,
  type Address,
  type Hex,
} from 'viem';
import { ADDRESSES, CHAIN_ID } from './registry.js';

// Transcribed from the observed official typed-data asset. Full deployed ABI/source remains unavailable.
export const intentTypes = {
  RegisterSessionKey: [
    { name: 'user', type: 'address' },
    { name: 'key', type: 'address' },
    { name: 'expiry', type: 'uint64' },
    { name: 'feeAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  OpenPosition: [
    { name: 'user', type: 'address' },
    { name: 'instrumentId', type: 'uint32' },
    { name: 'isLong', type: 'bool' },
    { name: 'size', type: 'uint128' },
    { name: 'leverage', type: 'uint32' },
    { name: 'useDebt', type: 'bool' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  Close: [
    { name: 'user', type: 'address' },
    { name: 'positionIds', type: 'uint256[]' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  WithdrawToCore: [
    { name: 'user', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  Stake: [
    { name: 'user', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  Unstake: [
    { name: 'user', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  Claim: [
    { name: 'user', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
  CancelIntent: [
    { name: 'user', type: 'address' },
    { name: 'intentId', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
export type IntentType = keyof typeof intentTypes;
export type IntentMessage = Record<
  string,
  string | boolean | number | bigint | readonly (string | bigint)[]
>;
export function intentDomain(type: IntentType) {
  if (type === 'Stake' || type === 'Unstake' || type === 'Claim')
    return {
      name: 'PaperStaking',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: ADDRESSES.PaperStaking,
    };
  if (type === 'CancelIntent')
    return {
      name: 'PaperTrade Intent Cancel',
      version: '2',
      chainId: CHAIN_ID,
      verifyingContract: ADDRESSES.Exchange,
    };
  return { name: 'String', version: '1', chainId: CHAIN_ID, verifyingContract: ADDRESSES.Exchange };
}
export function officialTypedData(type: IntentType, message: IntentMessage) {
  const expected = intentTypes[type];
  if (
    !expected ||
    Object.keys(message).length !== expected.length ||
    expected.some((field) => !(field.name in message))
  )
    throw new Error('Intent fields do not match official schema');
  return { domain: intentDomain(type), types: { [type]: expected }, primaryType: type, message };
}
export function serializeSigned(
  message: IntentMessage,
  signature: Hex,
): Record<string, unknown> & { r: Hex; s: Hex; v: string } {
  const parsed = parseSignature(signature);
  const fields = Object.fromEntries(
    Object.entries(message).map(([key, value]) => [
      key,
      typeof value === 'bigint'
        ? value.toString()
        : Array.isArray(value)
          ? value.map((item) => String(item))
          : typeof value === 'string' && value.startsWith('0x')
            ? value.toLowerCase()
            : value,
    ]),
  );
  return { ...fields, r: parsed.r, s: parsed.s, v: String(27 + Number(parsed.yParity)) };
}
export async function identifyIntent(type: IntentType, message: IntentMessage, signature: Hex) {
  const typedData = officialTypedData(type, message);
  const digest = hashTypedData(typedData);
  const signer = (
    await recoverTypedDataAddress({ ...typedData, signature })
  ).toLowerCase() as Address;
  const namespace = keccak256(toHex('papertrade:intent-id:v2'));
  return { digest, signer, intentId: keccak256(concat([namespace, digest, signer])) };
}
export const actionTypes = {
  registerSessionKey: 'RegisterSessionKey',
  openPosition: 'OpenPosition',
  closePositions: 'Close',
  withdrawToCore: 'WithdrawToCore',
  paperStake: 'Stake',
  paperUnstake: 'Unstake',
  paperClaim: 'Claim',
} as const satisfies Record<string, IntentType>;
