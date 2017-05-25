'use strict';


const log = require('./logger');

const fs = require('graceful-fs');
const path = require('path');
const readChunk = require('read-chunk');
const fileType = require('file-type');

const Glob = require('glob').Glob;

const Rx = require('rxjs');
const _ = require('lodash');

const Database = require('./database');

async function main() {
	log.info('App started');
	
	let args = parseAppArguments();
	let argPaths = [];
	
	if (args.length > 0) {
		let paths = parsePaths(args);
		logInvalidPaths(paths.invalid);
		argPaths = paths.valid;
	}

	let db = new Database();

    if (fs.existsSync(db.filesDbPath())) fs.unlink(db.filesDbPath());      // Delete file
    if (fs.existsSync(db.foldersDbPath())) fs.unlink(db.foldersDbPath());  // Delete file
	
	await insertNewPathsToDb(db, argPaths);
	
	
	Rx.Observable
		.from(getFolderPathsFromDbAsync(db))
		.mergeMap(folder => Rx.Observable.from(folder))
		.mergeMap(folder => searchFiles$(folder.path))
		.subscribe(async (fileInfo) => {
			console.log(await fileInfo);
			await db.files().insert(await fileInfo);
		}, err => {
            console.log(err.message);
            log.error(err);
        }, () => {
            console.log('Completed');
            log.info('Completed');
        });
	
	/*
	let dbAllFolders = await getFolderPathsFromDbAsync(db);
	
	dbAllFolders.forEach(folderInfo => {
		searchFiles$(folderInfo.path).subscribe(async (promise) => {
			//db.files().find({  });
			console.log(await promise);
		}, err => {
			log.error(err);
		}, () => {
			log.info(`Done searching folder "${folderInfo.path}"`);
		});
	});
	*/
}

async function insertNewPathsToDb(db, newPaths){
	let dbExistingPaths = await getFolderPathsFromDbAsync(db);
	console.log('ExistingPaths: ', dbExistingPaths, ' new paths: ', newPaths);
	let newFolders = findNonInsertedToDbFolderPaths(newPaths, dbExistingPaths);
	try {
		return await db.folders().insert(newFolders);
	}
	catch(err) {
		log.error(err);
	}
}

function getFolderPathsFromDbAsync(db){
	return db.folders().find({}, { path: 1, _id: 0 });
}

function findNonInsertedToDbFolderPaths(newPathsArr, dbPathsArr){
	let flattenDbPathsArr = dbPathsArr.map(record => record.path);
	return _.pullAll(newPathsArr, flattenDbPathsArr).map( element => ({ path: element }));
}

function parseAppArguments() {
	return process.argv.slice(2);
}

function parsePaths(arr) {
	let paths = {
		valid: [],
		invalid: []
	};
	for (let arg of arr) {
		if (fs.existsSync(arg))	paths.valid.push(arg);
		else paths.invalid.push(arg);
	}
	return paths;
}

function logInvalidPaths(pathsArr) {
	pathsArr.forEach(path => {
		let invalidPath = `Path "${path}" couldn't be found.`;
		log.warn(invalidPath);
	});
}

function searchFiles$(path) {
	return Rx.Observable.create(observer => {
		let matchCallback = filename => {
			observer.next(processFileInfoAsync(filename, path));
		};
		
		let mg = new Glob(path + '/**/*.*', { nodir: true });
		
		let onCompleteWrapper = () => observer.complete();
		let onErrorWrapper = err => observer.error(err);
		
		mg
		 .on('match', matchCallback)
		 .on('abort', onCompleteWrapper)
		 .on('error', onErrorWrapper)
		 .on('end', onCompleteWrapper);
		
		// Disposal function
		return () => {
			mg.removeListener('match', matchCallback);
			mg.removeListener('abort', onCompleteWrapper);
			mg.removeListener('error', onErrorWrapper);
			mg.removeListener('end', onCompleteWrapper);
		};
	});
}

async function processFileInfoAsync(filename, baseFolderPath) {
	let fileStats = await extractFileStatsAsync(filename);
	let mimeFileTypeObj = findMimeFileType(filename); // {"ext":"avi","mime":"video/x-msvideo"}
	
	const objResult = obj => {
		if (obj.hasOwnProperty('ext')) delete obj['ext'];
		obj['title'] = path.basename(filename);
		obj['subfolder'] = filename.replace(baseFolderPath, '').replace(obj['title'], '');
		obj['folder'] = baseFolderPath;
		obj['size'] = fileStats.size; // bytes
		return obj;
	};
	
	return mimeFileTypeObj == null ? objResult({}) : objResult(mimeFileTypeObj);
}

function extractFileStatsAsync(filename){
	return new Promise((resolve, reject) => {
		fs.stat(filename, (err, stats) => {
			if (err) reject(err);
			else resolve(stats);
		});
	});
}

function findMimeFileType(fileName){
	let buffer = readChunk.sync(fileName, 0, 4100);
	return fileType(buffer);
}

(async () => {
	await main();
})();