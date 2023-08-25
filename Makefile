export PROJECT=hlsavegameapi
export DOCKER_IMAGE=${PROJECT}:latest
export SERVICE=app
export PORT ?= 8080

define COMPOSE_CMD
docker compose -p ${PROJECT} \
  --project-directory=. \
  -f ./docker-compose.yaml
endef

container_build:
	docker build . -t ${DOCKER_IMAGE}

container_start:
	${COMPOSE_CMD} up -d ${SERVICE}

container_logs:
	${COMPOSE_CMD} logs -f ${SERVICE}

container_stop:
	${COMPOSE_CMD} down --remove-orphans

# for local computer
prepare:
	npm install

test:
	LD_LIBRARY_PATH=. node server.js
 