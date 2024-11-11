const BT1_TABLE_API = 'https://buildtools1.service-now.com/api/now/table/';
const APP_CERTIFICATION_TABLE = 'x_snc_store_certif_application_review';
const STORE_APP_COMPATIBILITY_TABLE = 'x_snc_store_certif_app_compatibility';
const APP_REPO_ARTIFACT_TABLE = 'x_snc_store_certif_application_repo';
const FAMILY_RELEASE_IDS = {
  xanadu: '1461e9af1b4f8610fb58db13b24bcba3',
  washington: '12df18741b1bb9501ca3db91b24bcbf2',
};
let bt1username = '';
let bt1password = '';
let appSysIds = [];
let finalResultsArray = [];
let finalResultdb = [];
let combinedOutput = '';
let tdTemplateAppsformattedOutput = '';
let tdTemplatepluginsformattedOutput = '';
let snAppDeployAppsData = '';
let templateType = '';

document.getElementById('callApi').addEventListener('click', async function () {
  finalResultdb = [];
  appSysIds = [];
  finalResultsArray = [];
  document.getElementById('formattedOutput').innerText = "Connecting to BT1... Please wait.";
  main();
});
async function main() {
  let certificationTableUrl = '';

  bt1username = document.getElementById('username').value;
  bt1password = document.getElementById('password').value;

  let appNumbers = document.getElementById('appNumber').value;
  let appNumberIds = appNumbers.split(',').map(appNumber => appNumber.trim());

  const familyRelease = document.getElementById('release').value;
  const familyReleaseId = FAMILY_RELEASE_IDS[familyRelease] || '';
  templateType = document.getElementById('templateFormat').value;

  document.getElementById('formattedOutput').innerText = "Retrieving main application details from BT1...";
  for (let i = 0; i < appNumberIds.length; i++) {
    certificationTableUrl = BT1_TABLE_API + APP_CERTIFICATION_TABLE + '?app_number=' + appNumberIds[i];
    try {
      let appSysIdsData = await makeApiCall(certificationTableUrl, bt1username, bt1password);
      appSysIds.push(appSysIdsData.result[0].sys_id);

      let mainAppScope = appSysIdsData.result[0].scope;
      let mainAppVersion = appSysIdsData.result[0].version;

      finalResultsArray.push({
        scope: mainAppScope,
        version: mainAppVersion
      });
    } catch (error) {
      document.getElementById('formattedOutput').innerText = `Error: ${error.message}`;
    }
  }

  for (let i = 0; i < appSysIds.length; i++) {
    compatibilityTableUrl = BT1_TABLE_API + STORE_APP_COMPATIBILITY_TABLE + '?application=' + appSysIds[i] + '&platform_release=' + familyReleaseId;

    try {
      let appCompatibilityData = await makeApiCall(compatibilityTableUrl, bt1username, bt1password);

      let dependecyStr = appCompatibilityData.result[0].dependencies;
      document.getElementById('formattedOutput').innerText = "Fetching dependent application details... Hang tight!";
      let dependecyPairs = dependecyStr.split(',');
      dependecyPairs.forEach(function (pair) {
        let parts = pair.split(':');
        let scope1 = parts[0];
        let version1 = parts[1];
        if (version1.includes('-')) {
          version1 = version1.split('-')[0] + '-SNAPSHOT';
        }
        finalResultsArray.push({
          scope: scope1,
          version: version1
        });
      });
    } catch (error) {
      document.getElementById('formattedOutput').innerText = `Error: ${error.message}`;
    }
  }


  let uniqueArray = finalResultsArray.filter((item, index, self) =>
    index === self.findIndex((obj) => obj.scope === item.scope && obj.version === item.version)
  );

  document.getElementById('formattedOutput').innerText = "Retrieving group and artifact IDs for applications... This may take a few moments.";
  let pluginList = "";
  let scopeList = "";

  uniqueArray.forEach((item) => {
    if (item.version === 'sys') {
      finalResultdb.push({
        scope: item.scope,
        version: item.version,
        artifactId: item.version,
        groupId: item.version,
        name: item.scope
      });
      pluginList += `${item.scope}, `;
    } else {
      scopeList += `${item.scope}, `;
    }
  });

  let appRepoArtifactTableUrl = '';
  appRepoArtifactTableUrl = BT1_TABLE_API + APP_REPO_ARTIFACT_TABLE + '?sysparm_query=scopeIN' + scopeList;
  let appartifactData = await makeApiCall(appRepoArtifactTableUrl, bt1username, bt1password);

  let addedScopes = new Set();

  appartifactData.result.forEach((artifact) => {
    // Extract artifact properties
    const { scope, artifact_id: artifactId, group_id: groupId, app_name: appName } = artifact;

    if (!addedScopes.has(scope)) {
      // Find matching scope in uniqueArray to get the version
      const match = uniqueArray.find((item) => item.scope === scope);

      // If a match is found, use its version
      if (match) {
        finalResultdb.push({
          scope: scope,
          version: match.version, // Get version from uniqueArray
          artifactId: artifactId,
          groupId: groupId,
          name: appName,
        });
        addedScopes.add(scope);
      }
    }
  });
  updateFormattedOutput(templateType);
  enableButtons();
}

function enableButtons() {
  document.getElementById('copyButton').disabled = false;
  document.getElementById('downloadButton').disabled = false;
  document.getElementById('tdTemplateButton').disabled = false;
  document.getElementById('snAppDeployButton').disabled = false;
  document.getElementById('pomFormatButton').disabled = false;
}

function updateFormattedOutput(outputFormat) {
  switch (outputFormat) {
    case 'tdTemplate':
      formatForTdTemplate(finalResultdb);
      break;
    case 'testProjectPOM':
      formatForTestProjectPOM(finalResultdb);
      break;
    case 'snAppDeploy':
      formatForSnAppDeploy(finalResultdb);
      break;
  }
}

document.getElementById('tdTemplateButton').addEventListener('click', () => {
  formatForTdTemplate(finalResultdb);
});

document.getElementById('snAppDeployButton').addEventListener('click', () => {
  formatForSnAppDeploy(finalResultdb);
});

document.getElementById('pomFormatButton').addEventListener('click', () => {
  formatForTestProjectPOM(finalResultdb);
});

function formatForTdTemplate(data) {
  document.getElementById('formattedOutput').innerText = "Formatting results as per the selected output template... Almost there!";
  const appsOutput = data.filter(d => d.version !== 'sys').map(d => `${d.groupId}:${d.artifactId}:${d.version}`).join(',\n');
  const pluginsOutput = data.filter(d => d.version === 'sys').map(d => d.scope).join(',\n');
  document.getElementById('formattedOutput').innerText = `"Plugins List:"\n${pluginsOutput}\n\n"Apps List:"\n${appsOutput}`;
}

function formatForTestProjectPOM(data) {
  document.getElementById('formattedOutput').innerText = "Formatting results as per the selected output template... Almost there!";

  const plugins = Array.from(new Set(data.filter(d => d.version === 'sys').map(d => d.scope))).join(', ');
  const scopedApps = Array.from(new Set(data.filter(d => d.version !== 'sys').map(d => `"${d.artifactId}"`))).join(', ');

  const properties = Array.from(new Set(data
    .filter(d => d.version !== 'sys')
    .map(d => `<${d.artifactId}.version>${d.version}</${d.artifactId}.version>`)))
    .join('\n\t\t');

  const dependencies = Array.from(new Set(data
    .filter(d => d.version !== 'sys')
    .map(d => `
      <dependency>
        <groupId>${d.groupId}</groupId>
        <artifactId>${d.artifactId}</artifactId>
        <version>\${${d.artifactId}.version}</version>
        <classifier>app</classifier>
        <scope>compile</scope>
      </dependency>`)))
    .join('\n');

  document.getElementById('formattedOutput').innerText = `
    Add the following plugins list to the **AA_SetupIT** file:\n "plugins": [${plugins}]
    
    \nAdd the scoped apps to the **AB_LoadAppsIT** file:\n @WithScopedApp(value = {${scopedApps}}, loadDemoData = true)
    
    \nInsert the properties and dependencies below in the test project **POM file**:
    <properties>\n${properties}\n</properties>
    ${dependencies}`;
}

function formatForSnAppDeploy(data) {
  document.getElementById('formattedOutput').innerText = "Formatting results as per the selected output template... Almost there!";

  // Build the JSON structure with specified format
  const appsData = {
    instanceURL: "http://localhost:8080/",
    username: "admin",
    password: "admin",
    plugins: Array.from(new Set(data.filter(d => d.version === 'sys').map(d => d.scope))),
    apps: Array.from(new Set(
      data.filter(d => d.version !== 'sys').map(d =>
        JSON.stringify({
          type: 'NEXUS_REPOSITORY',
          groupId: d.groupId,
          artifactId: d.artifactId,
          version: d.version,
        })
      )
    )).map(app => JSON.parse(app)), // Parse back to object
    hooks: {
      preDeploy: ""
    }
  };

  // Output the formatted JSON
  document.getElementById('formattedOutput').innerText = JSON.stringify(appsData, null, 2);
}

async function makeApiCall(url, username, password) {
  const auth = btoa(`${username}:${password}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return await response.json();
}

// Copy text to clipboard
document.getElementById('copyButton').addEventListener('click', function () {
  const textToCopy = document.getElementById('formattedOutput').innerText;
  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("Text copied to clipboard!");
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
});

//download output content into txt or Json file
document.getElementById('downloadButton').addEventListener('click', () => {
  const content = document.getElementById('formattedOutput').innerText;


  // Use .json extension for all types
  const fileName = `output.json`;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(url);
});


// Event listener for closeButton to close the popup
document.getElementById('closeButton').addEventListener('click', () => {
  window.close();
});