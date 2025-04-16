// backend/extract_text.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Executes the Python script to extract text from a PowerPoint file or count slides
 * @param {string} filePath - Path to the PowerPoint file
 * @param {boolean} countOnly - If true, only count slides without extracting text
 * @returns {Promise<Object>} - Result object containing extracted text data or slide count
 */
function extractText(filePath, countOnly = false) {
  return new Promise((resolve, reject) => {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File does not exist: ${filePath}`));
    }
    
    console.log(`Executing Python extract_text.py for file: ${filePath} (count only: ${countOnly})`);
    
    // Use the Python script in the same directory
    const pythonScript = path.join(__dirname, 'extract_text.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScript)) {
      return reject(new Error(`Python script not found: ${pythonScript}`));
    }
    
    // Prepare arguments
    const args = [pythonScript, filePath];
    if (countOnly) {
      args.push('count_only');
    }
    
    // Use python3 or python depending on the system
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    // Spawn python process
    const pythonProcess = spawn(pythonCommand, args);
    
    let scriptOutput = '';
    let scriptError = '';
    
    // Collect data from script
    pythonProcess.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code !== 0) {
        console.error(`Python extract_text.py error: ${scriptError}`);
        return reject(new Error(`Python process exited with code ${code}: ${scriptError}`));
      }
      
      // Parse the output
      try {
        const result = JSON.parse(scriptOutput);
        
        if (result.error) {
          return reject(new Error(result.error));
        }
        
        // Format the result based on countOnly mode
        if (countOnly) {
          if (result.data && result.data.slideCount !== undefined) {
            return resolve(result.data);
          } else {
            // If no explicit slide count, try to infer from data length
            if (Array.isArray(result.data)) {
              return resolve({ slideCount: result.data.length });
            } else {
              return reject(new Error('Could not determine slide count from Python output'));
            }
          }
        } else {
          return resolve(result.data);
        }
      } catch (err) {
        console.error('Error parsing Python output:', err);
        return reject(new Error(`Failed to parse Python output: ${err.message}`));
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

// Simple test function to verify Python execution
async function testPythonExecution() {
  try {
    // Try to execute a simple Python command
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    const testProcess = spawn(pythonCommand, ['-c', 'print("Python is working")']);
    
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Python test failed with code ${code}: ${error}`));
        }
      });
      
      testProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python test: ${err.message}`));
      });
    });
  } catch (err) {
    console.error('Python test execution error:', err);
    return false;
  }
}

// Run a quick test on module load
testPythonExecution()
  .then(() => console.log('Python execution test passed'))
  .catch(err => console.warn('Python execution test failed:', err.message));

module.exports = {
  extractText
};