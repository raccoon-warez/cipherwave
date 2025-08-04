const fs = require('fs');
const path = require('path');

// Create www directory if it doesn't exist
if (!fs.existsSync('www')) {
  fs.mkdirSync('www');
}

// Create js directory if it doesn't exist
if (!fs.existsSync('www/js')) {
  fs.mkdirSync('www/js');
}

// Copy files to www directory
const filesToCopy = [
  'index.html',
  'script.js',
  'styles.css'
];

filesToCopy.forEach(file => {
  const source = path.join(__dirname, file);
  const destination = path.join(__dirname, 'www', file);
  
  // Check if source file exists before copying
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
    console.log(`Copied ${file} to www directory`);
  } else {
    console.log(`Source file ${file} not found, skipping...`);
  }
});

// Copy CryptoJS library
const cryptoSource = path.join(__dirname, 'www/js/crypto-js.min.js');
if (!fs.existsSync(cryptoSource)) {
  // Download CryptoJS if it doesn't exist
  const https = require('https');
  
  const file = fs.createWriteStream(cryptoSource);
  const request = https.get('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js', function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();
      console.log('Downloaded CryptoJS library');
      runCapacitorSync();
    });
  });
} else {
  console.log('CryptoJS library already exists');
  runCapacitorSync();
}

function runCapacitorSync() {
  // Run Capacitor sync command
  const { exec } = require('child_process');
  
  exec('npx cap sync', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running Capacitor sync: ${error}`);
      return;
    }
    
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    
    console.log(`stdout: ${stdout}`);
    console.log('Capacitor sync completed successfully');
  });
}
