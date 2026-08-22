const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

describe('User CSV 认证兼容', () => {
  let tempDir;
  let User;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-user-csv-'));
    process.env.STORAGE_TYPE = 'local';
    process.env.LOCAL_PATH = tempDir;
    jest.resetModules();
    User = require('../src/models/User');
  });

  afterEach(() => {
    delete process.env.STORAGE_TYPE;
    delete process.env.LOCAL_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('findByEmailWithPassword 读取 password_hash 表头中的哈希', async () => {
    const hash = await bcrypt.hash('secret123', 4);
    const csvPath = path.join(tempDir, 'user-data', 'settings', 'users.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(
      csvPath,
      [
        'user_id,username,email,password_hash,created_at,last_login,status',
        `u1,jason,link918@qq.com,${hash},2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z,active`,
      ].join('\n'),
      'utf8'
    );

    const user = await User.findByEmailWithPassword('link918@qq.com');

    expect(user).toMatchObject({
      id: 'u1',
      username: 'jason',
      email: 'link918@qq.com',
      password: hash,
      status: 'active',
    });
  });

  test('findByEmailWithPassword 读取 password 表头中的哈希', async () => {
    const hash = await bcrypt.hash('secret123', 4);
    const csvPath = path.join(tempDir, 'user-data', 'settings', 'users.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(
      csvPath,
      [
        'user_id,username,email,password,created_at,updated_at,status',
        `u2,jason,link918@qq.com,${hash},2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z,active`,
      ].join('\n'),
      'utf8'
    );

    const user = await User.findByEmailWithPassword('link918@qq.com');

    expect(user.password).toBe(hash);
  });

  test('findByEmailWithPassword 按表头读取而不是固定第 4 列', async () => {
    const hash = await bcrypt.hash('secret123', 4);
    const csvPath = path.join(tempDir, 'user-data', 'settings', 'users.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(
      csvPath,
      [
        'email,user_id,status,username,last_login,password_hash,created_at',
        `link918@qq.com,u4,active,jason,2026-01-02T00:00:00.000Z,${hash},2026-01-01T00:00:00.000Z`,
      ].join('\n'),
      'utf8'
    );

    const user = await User.findByEmailWithPassword('link918@qq.com');

    expect(user).toMatchObject({
      id: 'u4',
      username: 'jason',
      email: 'link918@qq.com',
      password: hash,
      status: 'active',
    });
  });

  test('updateUser 更新 password_hash 表头对应列', async () => {
    const oldHash = await bcrypt.hash('old123', 4);
    const csvPath = path.join(tempDir, 'user-data', 'settings', 'users.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(
      csvPath,
      [
        'email,user_id,status,username,last_login,password_hash,created_at',
        `link918@qq.com,u5,active,jason,2026-01-02T00:00:00.000Z,${oldHash},2026-01-01T00:00:00.000Z`,
      ].join('\n'),
      'utf8'
    );

    await User.updateUser('u5', { password: 'new123' });
    const user = await User.findByEmailWithPassword('link918@qq.com');

    expect(await bcrypt.compare('new123', user.password)).toBe(true);
  });

  test('findByEmailWithPassword 遇到空 password_hash 时不返回可比较密码', async () => {
    const csvPath = path.join(tempDir, 'user-data', 'settings', 'users.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(
      csvPath,
      [
        'user_id,username,email,password_hash,created_at,last_login,status',
        'u3,jason,link918@qq.com,,2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z,active',
      ].join('\n'),
      'utf8'
    );

    const user = await User.findByEmailWithPassword('link918@qq.com');

    expect(user.password).toBe('');
  });
});
