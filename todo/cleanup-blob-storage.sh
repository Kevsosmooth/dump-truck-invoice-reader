#!/bin/bash

# Cleanup script for Azure Blob Storage training documents
# This will delete all test training files from failed attempts

CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=dumptruckinvoicereader;AccountKey=o82BOh/p8+Ql+SUVTkTMtcj50gFIMZIHrZkWCJgjrWm6vLDzmz5GvFEyJzKE9wbdwNztGBgIsfqf00BBYw0g+AStbKnrnQ==;EndpointSuffix=core.windows.net"
CONTAINER="training-documents"

echo "Current blob storage usage:"
az storage blob list --account-name dumptruckinvoicereader --container-name $CONTAINER --connection-string "$CONNECTION_STRING" --query "length(@)" -o tsv

echo "Total size (bytes):"
az storage blob list --account-name dumptruckinvoicereader --container-name $CONTAINER --connection-string "$CONNECTION_STRING" --query "sum([].properties.contentLength)" -o tsv

read -p "Do you want to delete all training files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Deleting all blobs in container..."
    az storage blob delete-batch --source $CONTAINER --connection-string "$CONNECTION_STRING"
    echo "Cleanup complete!"
else
    echo "Cleanup cancelled."
fi