import * as path from "path";
import moment = require("moment");
import Promise = require('promise');
import LineByLine = require('line-by-line');
import {Execs} from "../models/Execs";

export class ReaderLogService {

    readonly firstLine = Promise.denodeify(require('first-line'));
    readonly lastLine = Promise.denodeify(require('last-line'));

    /**
     * Retourne la date de début et la date de fin pour une execution
     * @param {Object} robot
     * @param {String} exec
     * @returns {Promise.<Object>}
     */
    getStartEnd(robot, exec) {
        const tracesPath = path.join(robot.dir, `${exec}-traces.log`);

        return Promise.all([
            this.firstLine(tracesPath),
            this.lastLine(tracesPath)
        ])
            .then((res) => {
                const dates = {
                    start: this.parseLineDate(res[0]),
                    end: this.parseLineDate(res[1])
                };

                if (!dates.start.isValid() || !dates.end.isValid()) {
                    return Promise.reject('Cannot parse dates');
                }
                else {
                    return Promise.resolve(dates);
                }
            });
    }

    /**
     * Récupère la date sur une ligne de log
     * @todo meilleure implémentation
     * @param {string} content
     * @returns {moment}
     */
    parseLineDate(content) {
        return moment(new Date(content.slice(0, 19)));
    }

    /**
     * Lecture d'un fichier de log en stream
     * @param {object} robot
     * @param {string} exec
     * @param {function} onData appellée pour chaque ligne de log
     * @returns {Promise}
     */
    readLog(robot, exec, onData) {
        return new Promise((resolve, reject) => {
            const tracesPath = path.join(robot.dir, `${exec}-traces.log`);
            const stream = new LineByLine(tracesPath);

            let current;

            stream.on('line', (line) => {
                // vérifie que la ligne commence par une date
                if (line.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}/)) {
                    if (current) {
                        onData(current, stream);
                    }
                    current = this.parseLog(line);
                    current.idexec = exec;
                }
                else if (current) {
                    current.message += '\n' + line;
                }
            });

            stream.on('end', () => {
                if (current) {
                    onData(current, stream);
                }
                resolve();
            });

            stream.on('error', reject);
        });
    }

    /**
     * Parse une ligne de log CSV
     * @param {string} line
     * @returns {object}
     */
    parseLog(line) {
        let matches = line.match(/^([^;]+);([^;]+);([^;]+);([^;]+);(.*)$/);

        if (matches) {
            return {
                date: moment(matches[1]).toDate(),
                level: matches[2],
                thread: matches[3],
                class: matches[4],
                message: matches[5]
            };
        }
        else {
            console.warn(`Not a log line: ${line}`);
            return null;
        }
    }

    /**
     * Lecture d'un fichier de log en batch de 20 lignes
     * @param {string} exec
     * @param {function} onData appellée pour chaque groupe de 20 lignes de log
     * @returns {Promise}
     */
    readLogBatch(robotDir, execName, onData) {
        let items = [];

        return this.readLog(robotDir, execName, (item, stream) => {
            items.push(item);

            if (items.length >= 20) {
                onData(items.slice(0), stream);
                items.length = 0;
            }
        })
            .then(() => {
                if (items.length > 0) {
                    onData(items);
                }
            });
    }
}
