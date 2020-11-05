// Takes in an address (regular or cashaddr format) and condenses it to display only the
// first 4 and last 4 characters
export function partialAddress(address: string) {
  if (address === 'mined') return 'Mined';
  const suffix = address.includes(':') ? address.split(':')[1] : address;
  return `${suffix.slice(0, 4)}....${suffix.slice(-4)}`;
}
