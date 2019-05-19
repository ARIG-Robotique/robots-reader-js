import {ReadStream} from "fs";

const Promise = require('promise');
const path = require('path');
const fs = require('fs');
const StreamArray = require('stream-json/utils/StreamArray');

export class ReadTimeSeriesService {

    /**
     * Lecture d'un fichier timeseries en stream
     * @param dir
     * @param url
     * @param onData
     */
    readTimeseries(dir: string, url: string, onData: (item: any, readStream: ReadStream) => void): Promise<any> {
        return new Promise((resolve) => {
            const timeseriesPath = path.join(dir, url);

            fs.access(timeseriesPath, (err) => {
                if (err) {
                    console.error(`${timeseriesPath} does not exists`);
                    resolve();
                }

                const stream = StreamArray.make();
                const fileStream: ReadStream = fs.createReadStream(timeseriesPath);

                stream.output.on('data', (item) => {
                    onData(item.value, fileStream);
                });

                stream.output.on('end', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.pipe(stream.input);
            });
        });
    }

    /**
     *
     * @param dir
     * @param exec
     * @param onData
     */
    readMouvementSeriesBatch(dir, exec, onData): Promise<any> {
        const url = `${exec}-mouvement.json`;
        return this.readSeriesFile(dir, url, onData);
    }

    /**
     * Lire le fichier *-timeseries.json en batch de 100 lignes.
     * @param dir
     * @param exec
     * @param onData
     */
    readTimeseriesBatch(dir: string, exec: string, onData: (items: any[]) => Promise<any>) {
        const url = `${exec}-timeseries.json`;
        return this.readSeriesFile(dir, url, onData);
    }

    readSeriesFile(dir: string, url: string, onData: (items: any[]) => Promise<any>): Promise<any> {
        let items = [];
        return this.readTimeseries(dir, url, (item: any, stream: ReadStream) => {
            items.push(item);

            if (items.length >= 100) {
                stream && stream.pause();

                onData(items.slice(0))
                    .then(() => {
                        stream && stream.resume();
                    }, (err: Error) => {
                        stream.destroy();
                        console.error(`Error while processing file ${dir} ${url} with error : ${err.stack}`);
                        return Promise.resolve();
                    });

                items.length = 0;
            }
        })
            .then(() => {
                return onData(items);
            });
    }
}
