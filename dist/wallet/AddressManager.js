"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressManager = void 0;
class AddressManager {
    constructor(HDWallet, network) {
        /**
         * Derives a new receive address. Sets related instance properties.
         */
        this.receiveAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('receive', this.receiveAddress.counter);
                this.receiveAddress.current = { address, privateKey };
                this.receiveAddress.keypairs[address] = privateKey;
                this.receiveAddress.atIndex[this.receiveAddress.counter] = address;
                this.receiveAddress.counter += 1;
                return address;
            },
            advance(n) {
                this.counter = n;
                this.next();
            },
        };
        /**
         * Derives a new change address. Sets related instance properties.
         */
        this.changeAddress = {
            counter: 0,
            // @ts-ignore
            current: {},
            keypairs: {},
            atIndex: {},
            next: () => {
                const { address, privateKey } = this.deriveAddress('change', this.changeAddress.counter);
                this.changeAddress.keypairs[address] = privateKey;
                this.changeAddress.current = { address, privateKey };
                this.changeAddress.atIndex[this.changeAddress.counter] = address;
                this.changeAddress.counter += 1;
                return address;
            },
            advance(n) {
                this.counter = n;
                // no call to next() here; composeTx calls it on demand.
            },
            reverse() {
                this.counter -= 1;
            },
        };
        this.HDWallet = HDWallet;
        this.network = network;
    }
    get all() {
        return Object.assign(Object.assign({}, this.receiveAddress.keypairs), this.changeAddress.keypairs);
    }
    get shouldFetch() {
        const receive = Object.entries(this.receiveAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.receiveAddress.counter - 1)
            .map((record) => record[1]);
        const change = Object.entries(this.changeAddress.atIndex)
            .filter((record) => parseInt(record[0], 10) <= this.changeAddress.counter)
            .map((record) => record[1]);
        return [...receive, ...change];
    }
    deriveAddress(deriveType, index) {
        const dType = deriveType === 'receive' ? 0 : 1;
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/${dType}'/${index}'`);
        return {
            address: privateKey.toAddress(this.network).toString(),
            privateKey,
        };
    }
    /**
     * Derives n addresses and adds their keypairs to their deriveType-respective address object
     * @param n How many addresses to derive
     * @param deriveType receive or change address
     * @param offset Index to start at in derive path
     */
    getAddresses(n, deriveType, offset = 0) {
        return [...Array(n).keys()].map((i) => {
            const index = i + offset;
            const { address, privateKey } = this.deriveAddress(deriveType, index);
            if (deriveType === 'receive') {
                this.receiveAddress.atIndex[index] = address;
                this.receiveAddress.keypairs[address] = privateKey;
            }
            else {
                this.changeAddress.atIndex[index] = address;
                this.changeAddress.keypairs[address] = privateKey;
            }
            return {
                index,
                address,
                privateKey,
            };
        });
    }
}
exports.AddressManager = AddressManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWRkcmVzc01hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvQWRkcmVzc01hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBSUEsTUFBYSxjQUFjO0lBQ3pCLFlBQVksUUFBOEIsRUFBRSxPQUFnQjtRQXlCNUQ7O1dBRUc7UUFDSCxtQkFBYyxHQU9WO1lBQ0YsT0FBTyxFQUFFLENBQUM7WUFDVixhQUFhO1lBQ2IsT0FBTyxFQUFFLEVBQUU7WUFDWCxRQUFRLEVBQUUsRUFBRTtZQUNaLE9BQU8sRUFBRSxFQUFFO1lBQ1gsSUFBSSxFQUFFLEdBQVcsRUFBRTtnQkFDakIsTUFBTSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUMzRixJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sR0FBRyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQztnQkFDdEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDO2dCQUNuRCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztnQkFDbkUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxPQUFPLE9BQU8sQ0FBQztZQUNqQixDQUFDO1lBQ0QsT0FBTyxDQUFDLENBQVM7Z0JBQ2YsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Z0JBQ2pCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNkLENBQUM7U0FDRixDQUFDO1FBRUY7O1dBRUc7UUFDSCxrQkFBYSxHQVFUO1lBQ0YsT0FBTyxFQUFFLENBQUM7WUFDVixhQUFhO1lBQ2IsT0FBTyxFQUFFLEVBQUU7WUFD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QUFPLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNwQyxNQUFNLEtBQUssR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ3pCLE1BQU0sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdEUsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFO2dCQUM1QixJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQzthQUNwRDtpQkFBTTtnQkFDTCxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQzthQUNuRDtZQUNELE9BQU87Z0JBQ0wsS0FBSztnQkFDTCxPQUFPO2dCQUNQLFVBQVU7YUFDWCxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5SEQsd0NBOEhDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQHRzLWlnbm9yZVxuaW1wb3J0IGJpdGNvcmUgZnJvbSAnYml0Y29yZS1saWItY2FzaCc7XG5pbXBvcnQgeyBOZXR3b3JrIH0gZnJvbSAnY3VzdG9tLXR5cGVzJztcblxuZXhwb3J0IGNsYXNzIEFkZHJlc3NNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoSERXYWxsZXQ6IGJpdGNvcmUuSERQcml2YXRlS2V5LCBuZXR3b3JrOiBOZXR3b3JrKSB7XG4gICAgdGhpcy5IRFdhbGxldCA9IEhEV2FsbGV0O1xuICAgIHRoaXMubmV0d29yayA9IG5ldHdvcms7XG4gIH1cblxuICBwcml2YXRlIEhEV2FsbGV0OiBiaXRjb3JlLkhEUHJpdmF0ZUtleTtcblxuICBuZXR3b3JrOiBOZXR3b3JrO1xuXG4gIGdldCBhbGwoKTogUmVjb3JkPHN0cmluZywgYml0Y29yZS5Qcml2YXRlS2V5PiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5yZWNlaXZlQWRkcmVzcy5rZXlwYWlycywgLi4udGhpcy5jaGFuZ2VBZGRyZXNzLmtleXBhaXJzIH07XG4gIH1cblxuICBnZXQgc2hvdWxkRmV0Y2goKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHJlY2VpdmUgPSBPYmplY3QuZW50cmllcyh0aGlzLnJlY2VpdmVBZGRyZXNzLmF0SW5kZXgpXG4gICAgICAuZmlsdGVyKFxuICAgICAgICAocmVjb3JkOiBbc3RyaW5nLCBzdHJpbmddKSA9PiBwYXJzZUludChyZWNvcmRbMF0sIDEwKSA8PSB0aGlzLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIgLSAxXG4gICAgICApXG4gICAgICAubWFwKChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHJlY29yZFsxXSk7XG4gICAgY29uc3QgY2hhbmdlID0gT2JqZWN0LmVudHJpZXModGhpcy5jaGFuZ2VBZGRyZXNzLmF0SW5kZXgpXG4gICAgICAuZmlsdGVyKChyZWNvcmQ6IFtzdHJpbmcsIHN0cmluZ10pID0+IHBhcnNlSW50KHJlY29yZFswXSwgMTApIDw9IHRoaXMuY2hhbmdlQWRkcmVzcy5jb3VudGVyKVxuICAgICAgLm1hcCgocmVjb3JkOiBbc3RyaW5nLCBzdHJpbmddKSA9PiByZWNvcmRbMV0pO1xuICAgIHJldHVybiBbLi4ucmVjZWl2ZSwgLi4uY2hhbmdlXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXJpdmVzIGEgbmV3IHJlY2VpdmUgYWRkcmVzcy4gU2V0cyByZWxhdGVkIGluc3RhbmNlIHByb3BlcnRpZXMuXG4gICAqL1xuICByZWNlaXZlQWRkcmVzczoge1xuICAgIGNvdW50ZXI6IG51bWJlcjtcbiAgICBjdXJyZW50OiB7IGFkZHJlc3M6IHN0cmluZzsgcHJpdmF0ZUtleTogYml0Y29yZS5Qcml2YXRlS2V5IH07XG4gICAga2V5cGFpcnM6IFJlY29yZDxzdHJpbmcsIGJpdGNvcmUuUHJpdmF0ZUtleT47XG4gICAgYXRJbmRleDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgICBuZXh0OiAoKSA9PiBzdHJpbmc7XG4gICAgYWR2YW5jZTogKG46IG51bWJlcikgPT4gdm9pZDtcbiAgfSA9IHtcbiAgICBjb3VudGVyOiAwLFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjdXJyZW50OiB7fSxcbiAgICBrZXlwYWlyczoge30sXG4gICAgYXRJbmRleDoge30sXG4gICAgbmV4dDogKCk6IHN0cmluZyA9PiB7XG4gICAgICBjb25zdCB7IGFkZHJlc3MsIHByaXZhdGVLZXkgfSA9IHRoaXMuZGVyaXZlQWRkcmVzcygncmVjZWl2ZScsIHRoaXMucmVjZWl2ZUFkZHJlc3MuY291bnRlcik7XG4gICAgICB0aGlzLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQgPSB7IGFkZHJlc3MsIHByaXZhdGVLZXkgfTtcbiAgICAgIHRoaXMucmVjZWl2ZUFkZHJlc3Mua2V5cGFpcnNbYWRkcmVzc10gPSBwcml2YXRlS2V5O1xuICAgICAgdGhpcy5yZWNlaXZlQWRkcmVzcy5hdEluZGV4W3RoaXMucmVjZWl2ZUFkZHJlc3MuY291bnRlcl0gPSBhZGRyZXNzO1xuICAgICAgdGhpcy5yZWNlaXZlQWRkcmVzcy5jb3VudGVyICs9IDE7XG4gICAgICByZXR1cm4gYWRkcmVzcztcbiAgICB9LFxuICAgIGFkdmFuY2UobjogbnVtYmVyKTogdm9pZCB7XG4gICAgICB0aGlzLmNvdW50ZXIgPSBuO1xuICAgICAgdGhpcy5uZXh0KCk7XG4gICAgfSxcbiAgfTtcblxuICAvKipcbiAgICogRGVyaXZlcyBhIG5ldyBjaGFuZ2UgYWRkcmVzcy4gU2V0cyByZWxhdGVkIGluc3RhbmNlIHByb3BlcnRpZXMuXG4gICAqL1xuICBjaGFuZ2VBZGRyZXNzOiB7XG4gICAgY291bnRlcjogbnVtYmVyO1xuICAgIGN1cnJlbnQ6IHsgYWRkcmVzczogc3RyaW5nOyBwcml2YXRlS2V5OiBiaXRjb3JlLlByaXZhdGVLZXkgfTtcbiAgICBrZXlwYWlyczogUmVjb3JkPHN0cmluZywgYml0Y29yZS5Qcml2YXRlS2V5PjtcbiAgICBhdEluZGV4OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIG5leHQ6ICgpID0+IHN0cmluZztcbiAgICBhZHZhbmNlOiAobjogbnVtYmVyKSA9PiB2b2lkO1xuICAgIHJldmVyc2U6ICgpID0+IHZvaWQ7XG4gIH0gPSB7XG4gICAgY291bnRlcjogMCxcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY3VycmVudDoge30sXG4gICAga2V5cGFpcnM6IHt9LFxuICAgIGF0SW5kZXg6IHt9LFxuICAgIG5leHQ6ICgpOiBzdHJpbmcgPT4ge1xuICAgICAgY29uc3QgeyBhZGRyZXNzLCBwcml2YXRlS2V5IH0gPSB0aGlzLmRlcml2ZUFkZHJlc3MoJ2NoYW5nZScsIHRoaXMuY2hhbmdlQWRkcmVzcy5jb3VudGVyKTtcbiAgICAgIHRoaXMuY2hhbmdlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG4gICAgICB0aGlzLmNoYW5nZUFkZHJlc3MuY3VycmVudCA9IHsgYWRkcmVzcywgcHJpdmF0ZUtleSB9O1xuICAgICAgdGhpcy5jaGFuZ2VBZGRyZXNzLmF0SW5kZXhbdGhpcy5jaGFuZ2VBZGRyZXNzLmNvdW50ZXJdID0gYWRkcmVzcztcbiAgICAgIHRoaXMuY2hhbmdlQWRkcmVzcy5jb3VudGVyICs9IDE7XG4gICAgICByZXR1cm4gYWRkcmVzcztcbiAgICB9LFxuICAgIGFkdmFuY2UobjogbnVtYmVyKTogdm9pZCB7XG4gICAgICB0aGlzLmNvdW50ZXIgPSBuO1xuICAgICAgLy8gbm8gY2FsbCB0byBuZXh0KCkgaGVyZTsgY29tcG9zZVR4IGNhbGxzIGl0IG9uIGRlbWFuZC5cbiAgICB9LFxuICAgIHJldmVyc2UoKTogdm9pZCB7XG4gICAgICB0aGlzLmNvdW50ZXIgLT0gMTtcbiAgICB9LFxuICB9O1xuXG4gIHByaXZhdGUgZGVyaXZlQWRkcmVzcyhcbiAgICBkZXJpdmVUeXBlOiAncmVjZWl2ZScgfCAnY2hhbmdlJyxcbiAgICBpbmRleDogbnVtYmVyXG4gICk6IHsgYWRkcmVzczogc3RyaW5nOyBwcml2YXRlS2V5OiBiaXRjb3JlLlByaXZhdGVLZXkgfSB7XG4gICAgY29uc3QgZFR5cGUgPSBkZXJpdmVUeXBlID09PSAncmVjZWl2ZScgPyAwIDogMTtcbiAgICBjb25zdCB7IHByaXZhdGVLZXkgfSA9IHRoaXMuSERXYWxsZXQuZGVyaXZlQ2hpbGQoYG0vNDQnLzk3Mi8wJy8ke2RUeXBlfScvJHtpbmRleH0nYCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZHJlc3M6IHByaXZhdGVLZXkudG9BZGRyZXNzKHRoaXMubmV0d29yaykudG9TdHJpbmcoKSxcbiAgICAgIHByaXZhdGVLZXksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXJpdmVzIG4gYWRkcmVzc2VzIGFuZCBhZGRzIHRoZWlyIGtleXBhaXJzIHRvIHRoZWlyIGRlcml2ZVR5cGUtcmVzcGVjdGl2ZSBhZGRyZXNzIG9iamVjdFxuICAgKiBAcGFyYW0gbiBIb3cgbWFueSBhZGRyZXNzZXMgdG8gZGVyaXZlXG4gICAqIEBwYXJhbSBkZXJpdmVUeXBlIHJlY2VpdmUgb3IgY2hhbmdlIGFkZHJlc3NcbiAgICogQHBhcmFtIG9mZnNldCBJbmRleCB0byBzdGFydCBhdCBpbiBkZXJpdmUgcGF0aFxuICAgKi9cbiAgZ2V0QWRkcmVzc2VzKG46IG51bWJlciwgZGVyaXZlVHlwZTogJ3JlY2VpdmUnIHwgJ2NoYW5nZScsIG9mZnNldCA9IDApIHtcbiAgICByZXR1cm4gWy4uLkFycmF5KG4pLmtleXMoKV0ubWFwKChpKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IGkgKyBvZmZzZXQ7XG4gICAgICBjb25zdCB7IGFkZHJlc3MsIHByaXZhdGVLZXkgfSA9IHRoaXMuZGVyaXZlQWRkcmVzcyhkZXJpdmVUeXBlLCBpbmRleCk7XG4gICAgICBpZiAoZGVyaXZlVHlwZSA9PT0gJ3JlY2VpdmUnKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZUFkZHJlc3MuYXRJbmRleFtpbmRleF0gPSBhZGRyZXNzO1xuICAgICAgICB0aGlzLnJlY2VpdmVBZGRyZXNzLmtleXBhaXJzW2FkZHJlc3NdID0gcHJpdmF0ZUtleTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2hhbmdlQWRkcmVzcy5hdEluZGV4W2luZGV4XSA9IGFkZHJlc3M7XG4gICAgICAgIHRoaXMuY2hhbmdlQWRkcmVzcy5rZXlwYWlyc1thZGRyZXNzXSA9IHByaXZhdGVLZXk7XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmRleCxcbiAgICAgICAgYWRkcmVzcyxcbiAgICAgICAgcHJpdmF0ZUtleSxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==