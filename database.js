'use strict';

const fs = require('graceful-fs');
const dbFolderPath = './db';
const foldersDbPath = dbFolderPath + '/folders.json';
const filesDbPath = dbFolderPath + '/files.json';

class Database {

	constructor(){
		this.Datastore = require('nedb-promise');
		this._folders = new this.Datastore({ filename: foldersDbPath, autoload: true });
		this._files = new this.Datastore({ filename: filesDbPath, autoload: true });
	}
	
	folders() {
		return this._folders;
	}
	
	files() {
		return this._files;
	}

	foldersDbPath() {
		return foldersDbPath;
	}

	filesDbPath() {
		return filesDbPath;
	}
}

module.exports = (() => {
	if (!fs.existsSync(dbFolderPath)) fs.mkdirSync(dbFolderPath);

	return Database;
})();