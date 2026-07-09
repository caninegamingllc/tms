import base64
import os
import struct
import sys
from pathlib import Path


def read_string(data: bytes, offset: int) -> tuple[bytes, int]:
    length = struct.unpack(">I", data[offset : offset + 4])[0]
    offset += 4
    return data[offset : offset + length], offset + length


def read_mpint(data: bytes, offset: int) -> tuple[int, int]:
    raw, offset = read_string(data, offset)
    if not raw:
        return 0, offset
    return int.from_bytes(raw, "big"), offset


def write_string(value: bytes) -> bytes:
    return struct.pack(">I", len(value)) + value


def write_mpint(value: int) -> bytes:
    if value == 0:
        raw = b""
    else:
        raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
        if raw[0] & 0x80:
            raw = b"\x00" + raw
    return write_string(raw)


def decode_lines(lines: list[str]) -> bytes:
    payload = "".join(line.strip() for line in lines)
    return base64.b64decode(payload)


def parse_ppk(path: Path) -> tuple[int, int, int, int, int, int]:
    content = path.read_text(encoding="utf-8").splitlines()
    if "Encryption: none" not in content:
        raise ValueError("Only unencrypted PPK files are supported.")

    public_start = content.index("Public-Lines: 6") + 1
    public_blob = decode_lines(content[public_start : public_start + 6])
    offset = 0
    key_type, offset = read_string(public_blob, offset)
    if key_type != b"ssh-rsa":
        raise ValueError("Only ssh-rsa keys are supported.")

    exponent_bytes, offset = read_string(public_blob, offset)
    exponent = int.from_bytes(exponent_bytes, "big")
    modulus, offset = read_mpint(public_blob, offset)

    private_start = content.index("Private-Lines: 14") + 1
    private_blob = decode_lines(content[private_start : private_start + 14])
    offset = 0
    private_exponent_bytes, offset = read_string(private_blob, offset)
    prime_p_bytes, offset = read_string(private_blob, offset)
    prime_q_bytes, offset = read_string(private_blob, offset)
    coefficient_bytes, offset = read_string(private_blob, offset)

    private_exponent = int.from_bytes(private_exponent_bytes, "big")
    prime_p = int.from_bytes(prime_p_bytes, "big")
    prime_q = int.from_bytes(prime_q_bytes, "big")
    coefficient = int.from_bytes(coefficient_bytes, "big")

    if prime_p * prime_q != modulus:
        raise ValueError("PPK public and private key components do not match.")

    phi = (prime_p - 1) * (prime_q - 1)
    if (exponent * private_exponent) % phi != 1:
        raise ValueError("PPK RSA key failed validation.")

    return modulus, exponent, private_exponent, prime_p, prime_q, coefficient


def encode_openssh_private_key(
    modulus: int,
    exponent: int,
    private_exponent: int,
    prime_p: int,
    prime_q: int,
    coefficient: int,
    comment: str = "tms-deploy-key",
) -> str:
    public_blob = write_string(b"ssh-rsa") + write_mpint(exponent) + write_mpint(modulus)
    check = os.urandom(4)
    private_blob = (
        check
        + check
        + write_string(b"ssh-rsa")
        + write_mpint(modulus)
        + write_mpint(exponent)
        + write_mpint(private_exponent)
        + write_mpint(coefficient)
        + write_mpint(prime_p)
        + write_mpint(prime_q)
        + write_string(comment.encode("utf-8"))
    )
    pad_len = (-len(private_blob)) % 8
    private_blob += bytes(range(1, pad_len + 1))

    payload = (
        b"openssh-key-v1\x00"
        + write_string(b"none")
        + write_string(b"none")
        + write_string(b"")
        + struct.pack(">I", 1)
        + write_string(public_blob)
        + write_string(private_blob)
    )
    body = base64.encodebytes(payload).decode("ascii")
    return "-----BEGIN OPENSSH PRIVATE KEY-----\n" + body + "-----END OPENSSH PRIVATE KEY-----\n"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python ppk-to-openssh.py <input.ppk> <output.pem>", file=sys.stderr)
        return 1

    modulus, exponent, private_exponent, prime_p, prime_q, coefficient = parse_ppk(Path(sys.argv[1]))
    pem = encode_openssh_private_key(modulus, exponent, private_exponent, prime_p, prime_q, coefficient)
    Path(sys.argv[2]).write_text(pem, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
