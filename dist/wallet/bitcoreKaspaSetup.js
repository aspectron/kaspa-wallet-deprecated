"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const bitcore = require("bitcore-lib-cash");
exports.default = () => {
    const networkPrefixes = ['kaspa', 'kaspadev', 'kaspareg', 'kaspatest', 'kaspasim'];
    networkPrefixes.map((str) => {
        return bitcore.Networks.add({
            name: str,
            prefix: str,
            pubkeyhash: 0x00,
            privatekey: 0x80,
            scripthash: 0x05,
            xpubkey: 0x0488b21e,
            xprivkey: 0x0488ade4,
            networkMagic: 0xdab5bffa,
        });
    });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYml0Y29yZUthc3BhU2V0dXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvYml0Y29yZUthc3BhU2V0dXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxhQUFhO0FBQ2IsNENBQTRDO0FBRzVDLGtCQUFlLEdBQUcsRUFBRTtJQUNsQixNQUFNLGVBQWUsR0FBYyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUU5RixlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBWSxFQUFFLEVBQUU7UUFDbkMsT0FBTyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztZQUMxQixJQUFJLEVBQUUsR0FBRztZQUNULE1BQU0sRUFBRSxHQUFHO1lBQ1gsVUFBVSxFQUFFLElBQUk7WUFDaEIsVUFBVSxFQUFFLElBQUk7WUFDaEIsVUFBVSxFQUFFLElBQUk7WUFDaEIsT0FBTyxFQUFFLFVBQVU7WUFDbkIsUUFBUSxFQUFFLFVBQVU7WUFDcEIsWUFBWSxFQUFFLFVBQVU7U0FDekIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAdHMtaWdub3JlXG5pbXBvcnQgKiBhcyBiaXRjb3JlIGZyb20gJ2JpdGNvcmUtbGliLWNhc2gnO1xuaW1wb3J0IHsgTmV0d29yayB9IGZyb20gJ2N1c3RvbS10eXBlcyc7XG5cbmV4cG9ydCBkZWZhdWx0ICgpID0+IHtcbiAgY29uc3QgbmV0d29ya1ByZWZpeGVzOiBOZXR3b3JrW10gPSBbJ2thc3BhJywgJ2thc3BhZGV2JywgJ2thc3BhcmVnJywgJ2thc3BhdGVzdCcsICdrYXNwYXNpbSddO1xuXG4gIG5ldHdvcmtQcmVmaXhlcy5tYXAoKHN0cjogTmV0d29yaykgPT4ge1xuICAgIHJldHVybiBiaXRjb3JlLk5ldHdvcmtzLmFkZCh7XG4gICAgICBuYW1lOiBzdHIsXG4gICAgICBwcmVmaXg6IHN0cixcbiAgICAgIHB1YmtleWhhc2g6IDB4MDAsIC8vIHB1YmxpY2tleSBoYXNoIHByZWZpeFxuICAgICAgcHJpdmF0ZWtleTogMHg4MCwgLy8gcHJpdmF0ZWtleSBwcmVmaXggLS0gbXVzdCBiZSAxMjggb3IgdG9XSUYoKSByZXN1bHQgd2lsbCBub3QgbWF0Y2ggd2l0aCBrYXNwYVxuICAgICAgc2NyaXB0aGFzaDogMHgwNSxcbiAgICAgIHhwdWJrZXk6IDB4MDQ4OGIyMWUsIC8vIGV4dGVuZGVkIHB1YmxpYyBrZXkgbWFnaWNcbiAgICAgIHhwcml2a2V5OiAweDA0ODhhZGU0LCAvLyBleHRlbmRlZCBwcml2YXRlIGtleSBtYWdpY1xuICAgICAgbmV0d29ya01hZ2ljOiAweGRhYjViZmZhLCAvLyBuZXR3b3JrIG1hZ2ljIG51bWJlclxuICAgIH0pO1xuICB9KTtcbn07XG4iXX0=