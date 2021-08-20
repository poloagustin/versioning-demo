FROM node:15

RUN mkdir -p /opt/custom-action

WORKDIR /opt/custom-action

COPY yarn.lock /opt/custom-action
COPY package.json /opt/custom-action
COPY tsconfig.json /opt/custom-action
COPY run.sh /opt/custom-action
COPY src /opt/custom-action/src

RUN yarn install && yarn cache clean && yarn build && cd $HOME

CMD ["sh", "/opt/custom-action/run.sh"]
