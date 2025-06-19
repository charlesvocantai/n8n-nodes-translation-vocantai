# This script builds your custom node, deploys it to your n8n custom nodes folder,
# and restarts the n8n Docker container.

##############################
# Step 0: Get Package Name
##############################
# Get package name from package.json
try {
    $PackageName = (Get-Content '.\package.json' | ConvertFrom-Json).name
    if ([string]::IsNullOrEmpty($PackageName)) {
        throw "Package name is empty"
    }
}
catch {
    Write-Error "Error: Could not determine package name from package.json."
    exit 1
}

# Set the target directory based on the package name
$TargetDir = "/c/n8n_data/custom/$PackageName"
# n8n-compose_n8n_data

Write-Host "Detected package name: '$PackageName'"
Write-Host "Target deployment directory: '$TargetDir'"

##############################
# Step 1: Build the Node
##############################
Write-Host "Building the node..."
pnpm run build

##############################
# Step 2: Deploy the Build Output
##############################
$SourceDir = ".\dist"

Write-Host "Deploying build output from '$SourceDir' to '$TargetDir'..."

# Remove any previous deployment and recreate the target directory
if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TargetDir -Force

# Copy all files from the build output to the target directory
Copy-Item -Path "$SourceDir\*" -Destination $TargetDir -Recurse -Force


# Create resources directory
# New-Item -ItemType Directory -Path "resources\vocant" -Force
# # Copy the SVG icon if you haven't already
# Copy-Item "path\to\your\vocant.svg" -Destination "resources\vocant\" -Force


Write-Host "Deployment complete."

##############################
# Step 3: Restart n8n
##############################
# Write-Host "Restarting n8n..."
# docker container restart n8n-compose-n8n-1

# # Show logs
# Write-Host "Showing n8n logs..."
# docker logs -f n8n-compose-n8n-1