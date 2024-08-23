#!/bin/sh

# exit when any command fails
set -e

./build_and_push.sh

gcloud run deploy deployment-api \
--image=europe-west2-docker.pkg.dev/blankly-135b6/blankly/deployment-api:1 \
--platform=managed \
--region=europe-west2 \
--project=blankly-135b6 \
 && gcloud run services update-traffic deployment-api --to-latest
