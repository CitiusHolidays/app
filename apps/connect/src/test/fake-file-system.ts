/**
 * An in-memory stand-in for expo-file-system's File/Directory API, for tests that must prove
 * what is written where and that it is gone afterwards. Use it as the module mock:
 *
 *   jest.mock('expo-file-system', () => require('@/test/fake-file-system').fakeFileSystem.module);
 */
const files = new Map<string, Uint8Array>();
const directories = new Set<string>();
/** Every create, write and delete, in order, as "write file:///…". */
const log: string[] = [];

function pathOf(parent: unknown, names: string[]) {
  const base = typeof parent === 'string' ? parent : (parent as { uri: string }).uri;
  return [base.replace(/\/$/, ''), ...names].join('/');
}

function parentOf(uri: string) {
  return uri.slice(0, uri.lastIndexOf('/'));
}

class Directory {
  uri: string;
  constructor(parent: unknown, ...names: string[]) {
    this.uri = pathOf(parent, names);
  }
  get exists() {
    return directories.has(this.uri);
  }
  create() {
    log.push(`mkdir ${this.uri}`);
    directories.add(this.uri);
  }
  delete() {
    if (!directories.has(this.uri)) throw new Error(`No directory at ${this.uri}`);
    log.push(`rmdir ${this.uri}`);
    directories.delete(this.uri);
    for (const key of [...files.keys()]) {
      if (key.startsWith(`${this.uri}/`)) files.delete(key);
    }
  }
}

class File {
  uri: string;
  constructor(parent: unknown, ...names: string[]) {
    this.uri = pathOf(parent, names);
  }
  get exists() {
    return files.has(this.uri);
  }
  get size() {
    return files.get(this.uri)?.length ?? 0;
  }
  create() {
    if (!directories.has(parentOf(this.uri))) throw new Error(`No directory for ${this.uri}`);
    log.push(`create ${this.uri}`);
    files.set(this.uri, new Uint8Array());
  }
  writeSync(content: string | Uint8Array | ArrayBuffer) {
    if (!directories.has(parentOf(this.uri))) throw new Error(`No directory for ${this.uri}`);
    log.push(`write ${this.uri}`);
    const bytes =
      typeof content === 'string' ? new TextEncoder().encode(content) : content instanceof Uint8Array ? content : new Uint8Array(content);
    files.set(this.uri, new Uint8Array(bytes));
  }
  async write(content: string | Uint8Array | ArrayBuffer) {
    this.writeSync(content);
  }
  delete() {
    if (!files.has(this.uri)) throw new Error(`No file at ${this.uri}`);
    log.push(`delete ${this.uri}`);
    files.delete(this.uri);
  }
}

export const fakeFileSystem = {
  directories,
  files,
  log,
  module: {
    Directory,
    File,
    // Documents are backed up to iCloud and Android Auto Backup; caches are not.
    Paths: { cache: { uri: 'file:///app/Library/Caches' }, document: { uri: 'file:///app/Documents' } },
  },
  reset() {
    files.clear();
    directories.clear();
    log.length = 0;
  },
};
