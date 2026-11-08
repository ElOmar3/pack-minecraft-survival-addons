const HEX = "0123456789abcdef";

function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8Bytes(value) {
  const text = String(value);
  const bytes = [];
  for (let index = 0; index < text.length; index++) {
    let point = text.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        point = 0x10000 + ((point - 0xd800) << 10) + (next - 0xdc00);
        index++;
      }
    }
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | (point >>> 6), 0x80 | (point & 63));
    else if (point <= 0xffff) bytes.push(0xe0 | (point >>> 12), 0x80 | ((point >>> 6) & 63), 0x80 | (point & 63));
    else bytes.push(0xf0 | (point >>> 18), 0x80 | ((point >>> 12) & 63), 0x80 | ((point >>> 6) & 63), 0x80 | (point & 63));
  }
  return bytes;
}

function bytesToHex(bytes) {
  let result = "";
  for (const byte of bytes) result += HEX[(byte >>> 4) & 15] + HEX[byte & 15];
  return result;
}

function hexToBytes(hex) {
  const value = String(hex).toLowerCase();
  if (!/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) throw new Error("invalid_hex");
  const bytes = [];
  for (let index = 0; index < value.length; index += 2) bytes.push(Number.parseInt(value.slice(index, index + 2), 16));
  return bytes;
}

export function sha256Bytes(inputBytes) {
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const bytes = Array.from(inputBytes, (value) => value & 255);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 255);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 255);

  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array(64);
    for (let index = 0; index < 16; index++) {
      const base = offset + index * 4;
      words[index] = ((bytes[base] << 24) | (bytes[base + 1] << 16) | (bytes[base + 2] << 8) | bytes[base + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  const output = [];
  for (const word of hash) for (let shift = 24; shift >= 0; shift -= 8) output.push((word >>> shift) & 255);
  return output;
}

export function sha256(value) {
  return bytesToHex(sha256Bytes(utf8Bytes(value)));
}

export function hmacSha256Hex(keyHex, message) {
  let key = hexToBytes(keyHex);
  if (key.length > 64) key = sha256Bytes(key);
  while (key.length < 64) key.push(0);
  const outer = key.map((byte) => byte ^ 0x5c);
  const inner = key.map((byte) => byte ^ 0x36);
  const innerHash = sha256Bytes([...inner, ...utf8Bytes(message)]);
  return bytesToHex(sha256Bytes([...outer, ...innerHash]));
}

export function constantTimeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) difference |= (a.charCodeAt(index % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(index % Math.max(1, b.length)) || 0);
  return difference === 0;
}
