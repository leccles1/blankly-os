#!/bin/sh
# docker build . -t us-docker.pkg.dev/blankly-dev/deployment-api/deployment-api:1
docker build . -t europe-west2-docker.pkg.dev/blankly-135b6/blankly/deployment-api:1
#                 us-docker.pkg.dev/$GCP_PROJECT_ID/models/$PROJECT_ID-$MODEL_ID:$VERSION_ID
docker push europe-west2-docker.pkg.dev/blankly-135b6/blankly/deployment-api:1
