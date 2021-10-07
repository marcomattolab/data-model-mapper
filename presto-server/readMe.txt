# Prestodb
This repository contains the docker-compose for "prestodb", version "0.262".

The Presto UI is available on http://localhost:8080/ui/

The used configuration on path "\etc\config.properties" is about a single machine for testing that will function as both a coordinator and worker.
See https://prestodb.io/docs/current/installation/deployment.html#config-properties for other configurations.

## Table of Contents
1. [Docker](#docker)
1. [Docker-compose](#docker-compose)
1. [Presto-cli](#presto-cli)
1. [Resources](#resources)
1. [License](#license)


## Docker

Build docker image:

```bash
$ cd presto-docker
$ docker build --build-arg PRESTO_VERSION="0.262" . -t prestodb:latest
```

Rum docker image:

```bash
$ cd presto-docker
$ docker run --name presto prestodb:latest
```


## Docker-compose

Run docker image:


```bash
$ cd presto-docker
$ docker-compose up
```


## Presto-cli

Use the Presto CLI to connect to Presto


```bash
$ cd presto-docker
$ docker exec -it <container_presto> presto
```


Execute a query against the tpch catalog

```bash
$ SELECT
   l.returnflag,
   l.linestatus,
   sum(l.quantity)                                       AS sum_qty,
   sum(l.extendedprice)                                  AS sum_base_price,
   sum(l.extendedprice * (1 - l.discount))               AS sum_disc_price,
   sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) AS sum_charge,
   avg(l.quantity)                                       AS avg_qty,
   avg(l.extendedprice)                                  AS avg_price,
   avg(l.discount)                                       AS avg_disc,
   count(*)                                              AS count_order
 FROM
   tpch.sf1.lineitem AS l
 WHERE
   l.shipdate <= DATE '1998-12-01' - INTERVAL '90' DAY
 GROUP BY
   l.returnflag,
   l.linestatus
 ORDER BY
   l.returnflag,
   l.linestatus;
```


Execute a query against the postgres connector (postgresql)

```bash
$ SELECT * 
  FROM postgresql.public.users;
```


Execute a query against the more connectors  JOIN (postgresql, tpch)

```bash
$ SELECT 
	u.*, 
	l.* 
FROM 	postgresql.public.users as u, 
		tpch.sf1.lineitem AS l 
WHERE l.returnflag = u.name 
and l.linenumber in (1, 2); 
```




## Resources

More information

```bash
$ https://prestodb.io/docs/current/installation/deployment.html
$ https://github.com/johannestang/bigdata_stack
$ https://docs.starburst.io/312-e/docker.html
$ https://raw.githubusercontent.com/johannestang/bigdata_stack/master/docker-compose.yml
```




## License

[Apache License, Version 2.0](LICENSE.md)

