# Automated Integration Tests on multiple Portainer versions

This test suite runs integration tests against multiple Portainer instances (ranging from versions 2.11 - 2.27) running on ports 16000-16003. It automatically sets up CI users, generates API tokens, and runs the integration test suite against each instance.

1. make sure, that the node is part of a swarm network

```sh
docker swarm init
```

2. deploy the portainer stack

```sh
docker stack deploy -c portainer-matrix-compose.yml portainer-matrix
```

3. wait for the portainer stack to be up and running

```sh
docker stack ps portainer-matrix
```

4. run the automated setup and integration tests

```sh
./portainer-matrix-testall.sh
```

5. if you're done, you can remove the stack

```sh
docker stack rm portainer-matrix
```
