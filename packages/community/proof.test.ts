import test from 'node:test';
import assert from 'node:assert/strict';
import { communityMessage, validateCommunityChallenge, validateParticipant } from './proof.js';
test('community signing accepts only the expected account, origin, campaign action, points and short expiry', () => {
  const expected = {
    address: '0x' + '22'.repeat(20),
    origin: 'https://paperclub.example',
    action: 'join' as const,
  };
  const expiresAt = 301000,
    message = communityMessage({ ...expected, nonce: 'ab'.repeat(16), expiresAt });
  const challenge = {
    id: '79fd71e1-f9bf-4f56-af73-95751bbf6401',
    message,
    expiresAt,
    action: 'join',
    points: 10,
  };
  assert.equal(validateCommunityChallenge(challenge, expected, 1000).message, message);
  for (const changed of [
    { ...challenge, message: message.replace(expected.origin, 'https://other.example') },
    { ...challenge, message: message.replace(expected.address, '0x' + '33'.repeat(20)) },
    { ...challenge, message: message.replace('founding-01', 'another-campaign') },
    { ...challenge, message: message + '\nApprove all tokens' },
    { ...challenge, points: 70 },
    { ...challenge, action: 'track' },
    { ...challenge, id: 'bad' },
    { ...challenge, expiresAt: 1000 },
    { ...challenge, expiresAt: 400000 },
  ])
    assert.throws(
      () => validateCommunityChallenge(changed, expected, 1000),
      /participation request/,
    );
});
test('participant progress cannot cross accounts, duplicate actions or invent points', () => {
  const address = '0x' + '22'.repeat(20),
    participant = { address, total: 70, completed: ['join', 'quiz', 'track'] };
  assert.equal(validateParticipant(participant, address).total, 70);
  for (const invalid of [
    { ...participant, address: '0x' + '33'.repeat(20) },
    { ...participant, total: 71 },
    { ...participant, total: 20, completed: ['join', 'join'] },
    { ...participant, completed: ['__proto__'] },
  ])
    assert.throws(() => validateParticipant(invalid, address), /verified/);
});
