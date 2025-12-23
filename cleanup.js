const fs = require('fs');
const path = 'app/(tabs)/index.tsx';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split(/\r?\n/);

    // We want to keep lines 0 to 1008 (1-based 1 to 1009)
    // And keep lines from 1851 (1-based 1852) to end
    // So we remove indices 1009 to 1850 inclusive.

    // index 1007 is line 1008: "}"
    // index 1008 is line 1009: "" (blank)
    // index 1009 is line 1010: "const styles = StyleSheet.create({" -> DELETE START
    // ...
    // index 1850 is line 1851: "" (blank before style) -> DELETE END
    // index 1851 is line 1852: "const styles = StyleSheet.create({" -> KEEP

    // Verification logic:
    if (!lines[1009].includes('const styles = StyleSheet.create')) {
        console.error('Line 1010 mismatch:', lines[1009]);
        process.exit(1);
    }
    if (!lines[1851].includes('const styles = StyleSheet.create')) {
        console.error('Line 1852 mismatch:', lines[1851]);
        // Adjust search if needed
        let found = -1;
        for (let i = 1840; i < 1860; i++) {
            if (lines[i].includes('const styles = StyleSheet.create')) {
                found = i;
                break;
            }
        }
        if (found !== -1) {
            console.log(`Found real styles at index ${found} (line ${found + 1})`);
            // We splice from 1009 to found-1 not inclusive? 
            // We want to remove up to found-1.
            // lines.splice(1009, found - 1009);
        } else {
            console.error('Could not find second styles definition');
            process.exit(1);
        }
    }

    const startIdx = 1009;
    let endIdx = 1851; // default if matches

    // Dynamic check
    for (let i = startIdx + 100; i < lines.length; i++) {
        if (lines[i].trim().startsWith('const styles = StyleSheet.create({')) {
            endIdx = i;
            break;
        }
    }

    console.log(`Removing lines ${startIdx + 1} to ${endIdx}`);
    lines.splice(startIdx, endIdx - startIdx);

    fs.writeFileSync(path, lines.join('\n'));
    console.log('Cleanup successful');

} catch (e) {
    console.error(e);
}
